"""Simple sliding-window rate limiter utilities."""

from __future__ import annotations

from collections import deque
from threading import Lock
from typing import Deque, Dict
import time


class SlidingWindowRateLimiter:
    """In-memory rate limiter that tracks attempts per key over a time window."""

    def __init__(self, *, max_attempts: int, window_seconds: int) -> None:
        self.max_attempts = max(1, max_attempts)
        self.window_seconds = max(1, window_seconds)
        self._attempts: Dict[str, Deque[float]] = {}
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        """Return True when the call is permitted for the provided key."""

        now = time.monotonic()
        with self._lock:
            bucket = self._attempts.setdefault(key, deque())
            while bucket and now - bucket[0] > self.window_seconds:
                bucket.popleft()
            if len(bucket) >= self.max_attempts:
                return False
            bucket.append(now)
            if not bucket:
                self._attempts.pop(key, None)
        return True


__all__ = ["SlidingWindowRateLimiter"]
