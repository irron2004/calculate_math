"""Password hashing helpers built on the system libargon2 implementation."""

from __future__ import annotations

import ctypes
import secrets
from typing import Dict

TIME_COST = 3
MEMORY_COST_KIB = 65536
PARALLELISM = 2
HASH_LENGTH = 32
SALT_LENGTH = 16
ARGON2_OK = 0
ARGON2_VERIFY_MISMATCH = -35


def _load_lib() -> ctypes.CDLL:
    for candidate in ("libargon2.so.1", "libargon2.so"):
        try:
            return ctypes.cdll.LoadLibrary(candidate)
        except OSError:
            continue
    raise RuntimeError("libargon2 shared library not found; install libargon2")


_LIB = _load_lib()

_argon2id_hash_encoded = _LIB.argon2id_hash_encoded
_argon2id_hash_encoded.argtypes = [
    ctypes.c_uint32,
    ctypes.c_uint32,
    ctypes.c_uint32,
    ctypes.c_char_p,
    ctypes.c_size_t,
    ctypes.c_char_p,
    ctypes.c_size_t,
    ctypes.c_size_t,
    ctypes.c_char_p,
    ctypes.c_size_t,
]
_argon2id_hash_encoded.restype = ctypes.c_int

_argon2id_verify = _LIB.argon2id_verify
_argon2id_verify.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_size_t]
_argon2id_verify.restype = ctypes.c_int

_argon2_error_message = _LIB.argon2_error_message
_argon2_error_message.argtypes = [ctypes.c_int]
_argon2_error_message.restype = ctypes.c_char_p


def _raise_error(code: int) -> None:
    message = _argon2_error_message(code)
    detail = message.decode("utf-8") if message else f"argon2 error {code}"
    raise RuntimeError(detail)


def hash_password(raw: str, *, pepper: str) -> str:
    """Return an Argon2id hash for the provided password + pepper."""

    password_bytes = f"{raw}{pepper}".encode("utf-8")
    salt = secrets.token_bytes(SALT_LENGTH)
    encoded = ctypes.create_string_buffer(512)
    rc = _argon2id_hash_encoded(
        ctypes.c_uint32(TIME_COST),
        ctypes.c_uint32(MEMORY_COST_KIB),
        ctypes.c_uint32(PARALLELISM),
        ctypes.c_char_p(password_bytes),
        ctypes.c_size_t(len(password_bytes)),
        ctypes.c_char_p(salt),
        ctypes.c_size_t(len(salt)),
        ctypes.c_size_t(HASH_LENGTH),
        encoded,
        ctypes.c_size_t(len(encoded)),
    )
    if rc != ARGON2_OK:
        _raise_error(rc)
    return encoded.value.decode("utf-8")


def verify_password(raw: str, stored_hash: str, *, pepper: str) -> bool:
    """Verify the provided password against the stored hash."""

    password_bytes = f"{raw}{pepper}".encode("utf-8")
    rc = _argon2id_verify(
        stored_hash.encode("utf-8"),
        ctypes.c_char_p(password_bytes),
        ctypes.c_size_t(len(password_bytes)),
    )
    if rc == ARGON2_OK:
        return True
    if rc == ARGON2_VERIFY_MISMATCH:
        return False
    _raise_error(rc)
    return False


def _parse_parameters(stored_hash: str) -> Dict[str, int] | None:
    try:
        parts = stored_hash.split("$")
        params_part = parts[3]
        pairs = params_part.split(",")
        parsed: Dict[str, int] = {}
        for pair in pairs:
            key, value = pair.split("=", 1)
            parsed[key] = int(value)
        return parsed
    except (IndexError, ValueError):
        return None


def needs_rehash(stored_hash: str) -> bool:
    """Return True when the stored hash should be regenerated."""

    if not is_argon_hash(stored_hash):
        return True
    params = _parse_parameters(stored_hash)
    if not params:
        return True
    if params.get("m") != MEMORY_COST_KIB:
        return True
    if params.get("t") != TIME_COST:
        return True
    if params.get("p") != PARALLELISM:
        return True
    return False


def is_argon_hash(stored_hash: str) -> bool:
    return stored_hash.startswith("$argon2id$")


__all__ = ["hash_password", "verify_password", "needs_rehash", "is_argon_hash"]
