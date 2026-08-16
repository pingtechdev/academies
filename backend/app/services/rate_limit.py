"""In-memory sliding-window rate limiter for login endpoints.

Single-process only (fine for MVP scale per backend.md §3) — swap for a Redis-backed limiter
if the backend is ever run with multiple workers/replicas.
"""

import time
from collections import defaultdict

from fastapi import HTTPException, status

from app.core.config import get_settings

_attempts: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(key: str) -> None:
    settings = get_settings()
    now = time.monotonic()
    window_start = now - settings.login_rate_limit_window_seconds

    attempts = [t for t in _attempts[key] if t > window_start]
    if len(attempts) >= settings.login_rate_limit_attempts:
        _attempts[key] = attempts
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
        )

    attempts.append(now)
    _attempts[key] = attempts
