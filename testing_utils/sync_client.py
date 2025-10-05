"""Synchronous ASGI client used by test suites without httpx dependency."""
from __future__ import annotations

import itertools
import json
from dataclasses import dataclass
from typing import Any, Dict, Iterable, Iterator, List, Mapping, Optional
from urllib.parse import urlencode, urljoin, urlparse, urlunparse

import anyio
from anyio.from_thread import BlockingPortal, start_blocking_portal

DEFAULT_BASE_URL = "http://testserver"
_REDIRECT_STATUSES = {301, 302, 303, 307, 308}


def _lower_dict(mapping: Mapping[str, str]) -> Dict[str, str]:
    return {key.lower(): value for key, value in mapping.items()}


class Headers(Mapping[str, str]):
    """Case-insensitive headers container used by the response object."""

    def __init__(self, items: Iterable[tuple[str, str]]) -> None:
        self._items: List[tuple[str, str]] = list(items)
        self._lookup: Dict[str, str] = {}
        for key, value in self._items:
            self._lookup[key.lower()] = value

    def __getitem__(self, key: str) -> str:
        lowered = key.lower()
        if lowered not in self._lookup:
            raise KeyError(key)
        return self._lookup[lowered]

    def __iter__(self) -> Iterator[str]:
        return (key for key, _ in self._items)

    def __len__(self) -> int:
        return len(self._items)

    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        return self._lookup.get(key.lower(), default)

    def items(self) -> Iterable[tuple[str, str]]:
        return list(self._items)


@dataclass
class Response:
    """Simplified HTTP response object returned by the sync client."""

    status_code: int
    headers: Headers
    content: bytes
    url: str

    def json(self) -> Any:
        if not self.content:
            raise ValueError("No JSON body present in response")
        return json.loads(self.content.decode("utf-8"))

    @property
    def text(self) -> str:
        return self.content.decode("utf-8")


async def _startup_app(app) -> Any:
    """Run FastAPI lifespan/startup hooks and return the context manager."""

    lifespan_cm = app.router.lifespan_context
    if lifespan_cm is not None:  # FastAPI >=0.95
        manager = lifespan_cm(app)
        await manager.__aenter__()
        return manager

    await app.router.startup()
    return None


async def _shutdown_app(app, manager) -> None:
    if manager is not None:
        await manager.__aexit__(None, None, None)
    else:
        await app.router.shutdown()


def _encode_data(data: Any) -> tuple[bytes, Dict[str, str]]:
    headers: Dict[str, str] = {}
    if data is None:
        return b"", headers

    if isinstance(data, (bytes, bytearray)):
        return bytes(data), headers

    if isinstance(data, str):
        return data.encode("utf-8"), headers

    if isinstance(data, Mapping):
        return urlencode(data, doseq=True).encode("utf-8"), {
            "content-type": "application/x-www-form-urlencoded"
        }

    raise TypeError(f"Unsupported data type: {type(data)!r}")


def _prepare_body(
    *,
    json_body: Any = None,
    data: Any = None,
    content: Optional[bytes] = None,
) -> tuple[bytes, Dict[str, str]]:
    if json_body is not None:
        return (
            json.dumps(json_body, separators=(",", ":")).encode("utf-8"),
            {"content-type": "application/json"},
        )

    if content is not None:
        return bytes(content), {}

    return _encode_data(data)


async def _call_app(
    app,
    scope: Dict[str, Any],
    body: bytes,
) -> Response:
    response_body = bytearray()
    status_code: Optional[int] = None
    headers: List[tuple[str, str]] = []

    request_complete = False
    response_complete = anyio.Event()

    async def receive() -> Dict[str, Any]:
        nonlocal request_complete
        if request_complete:
            await response_complete.wait()
            return {"type": "http.disconnect"}
        request_complete = True
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(message: Dict[str, Any]) -> None:
        nonlocal status_code, headers
        message_type = message.get("type")
        if message_type == "http.response.start":
            status_code = message["status"]
            raw_headers = message.get("headers", [])
            headers = [
                (key.decode("latin-1"), value.decode("latin-1"))
                for key, value in raw_headers
            ]
        elif message_type == "http.response.body":
            response_body.extend(message.get("body", b""))
            if not message.get("more_body", False):
                response_complete.set()

    await app(scope, receive, send)

    assert status_code is not None, "Application returned no response"
    return Response(
        status_code=status_code,
        headers=Headers(headers),
        content=bytes(response_body),
        url=scope.get("raw_path", b"").decode("latin-1"),
    )


def _build_scope(
    app,
    *,
    url: str,
    method: str,
    headers: Mapping[str, str],
    query: str,
    client_addr: tuple[str, int],
) -> Dict[str, Any]:
    parsed = urlparse(url)
    host = parsed.hostname or "testserver"
    scheme = parsed.scheme or "http"
    port = parsed.port or (443 if scheme == "https" else 80)

    header_list: List[tuple[bytes, bytes]] = []
    header_list.append((b"host", host.encode("latin-1")))
    for key, value in headers.items():
        header_list.append((key.lower().encode("latin-1"), value.encode("latin-1")))

    return {
        "type": "http",
        "http_version": "1.1",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "method": method,
        "scheme": scheme,
        "path": parsed.path or "/",
        "raw_path": (parsed.path or "/").encode("latin-1"),
        "query_string": query.encode("latin-1"),
        "headers": header_list,
        "client": client_addr,
        "server": (host, port),
        "root_path": "",
        "app": app,
        "state": {},
    }


async def _perform_request(
    app,
    base_url: str,
    method: str,
    target_url: str,
    params: Optional[Mapping[str, Any]],
    headers: Optional[Mapping[str, str]],
    json_body: Any,
    data: Any,
    content: Optional[bytes],
    follow_redirects: bool,
    client_addr: tuple[str, int],
    max_redirects: int = 5,
) -> Response:
    params = params or {}
    headers = _lower_dict(headers or {})

    combined = urljoin(base_url, target_url)
    parsed = urlparse(combined)

    query_items = []
    if parsed.query:
        query_items.append(parsed.query)
    if params:
        query_items.append(urlencode(params, doseq=True))
    query_string = "&".join(part for part in query_items if part)

    if query_string:
        parsed = parsed._replace(query=query_string)
        combined = urlunparse(parsed)

    body, body_headers = _prepare_body(json_body=json_body, data=data, content=content)
    for key, value in body_headers.items():
        headers.setdefault(key, value)
    if body and "content-length" not in headers:
        headers["content-length"] = str(len(body))

    redirect_chain: List[Response] = []
    current_url = combined

    for _ in range(max_redirects + 1):
        scope = _build_scope(
            app,
            url=current_url,
            method=method.upper(),
            headers=headers,
            query=urlparse(current_url).query,
            client_addr=client_addr,
        )
        response = await _call_app(app, scope, body)

        if not follow_redirects or response.status_code not in _REDIRECT_STATUSES:
            response.history = tuple(redirect_chain)  # type: ignore[attr-defined]
            response.url = current_url
            return response

        location = response.headers.get("location")
        if not location:
            response.history = tuple(redirect_chain)  # type: ignore[attr-defined]
            response.url = current_url
            return response

        redirect_chain.append(response)
        current_url = urljoin(current_url, location)

    raise RuntimeError("Exceeded maximum number of redirects")


class SyncASGIClient:
    _client_counter = itertools.count(1)

    def __init__(
        self,
        app,
        *,
        base_url: str = DEFAULT_BASE_URL,
        follow_redirects: bool = True,
        **kwargs: Any,
    ) -> None:
        self._app = app
        self._base_url = base_url
        self._default_follow_redirects = follow_redirects
        counter = next(self._client_counter)
        self._client_addr = (f"testclient-{counter}", 50000 + counter)
        self._portal_cm = start_blocking_portal()
        self._portal: BlockingPortal | None = self._portal_cm.__enter__()
        self._lifespan_manager = self._portal.call(_startup_app, app)

    def request(self, method: str, url: str, **kwargs: Any) -> Response:
        assert self._portal is not None
        follow_redirects = kwargs.pop("follow_redirects", None)
        response = self._portal.call(
            _perform_request,
            self._app,
            self._base_url,
            method,
            url,
            kwargs.get("params"),
            kwargs.get("headers"),
            kwargs.get("json"),
            kwargs.get("data"),
            kwargs.get("content"),
            self._default_follow_redirects if follow_redirects is None else follow_redirects,
            self._client_addr,
        )
        return response

    def get(self, url: str, **kwargs: Any) -> Response:
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs: Any) -> Response:
        return self.request("POST", url, **kwargs)

    def put(self, url: str, **kwargs: Any) -> Response:
        return self.request("PUT", url, **kwargs)

    def patch(self, url: str, **kwargs: Any) -> Response:
        return self.request("PATCH", url, **kwargs)

    def delete(self, url: str, **kwargs: Any) -> Response:
        return self.request("DELETE", url, **kwargs)

    def close(self) -> None:
        if self._portal is None:
            return
        try:
            self._portal.call(_shutdown_app, self._app, self._lifespan_manager)
        finally:
            self._portal_cm.__exit__(None, None, None)
            self._portal = None
            self._lifespan_manager = None


def create_client(
    app,
    *,
    base_url: str = DEFAULT_BASE_URL,
    follow_redirects: bool = True,
    **kwargs: Any,
) -> SyncASGIClient:
    return SyncASGIClient(
        app,
        base_url=base_url,
        follow_redirects=follow_redirects,
        **kwargs,
    )
