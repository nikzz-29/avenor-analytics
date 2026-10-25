import hashlib
import hmac
import secrets
from collections import defaultdict, deque
from datetime import UTC, datetime
from time import monotonic
from typing import Annotated

from argon2 import PasswordHasher
from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Member, Session, User
from app.db.session import get_db

DB = Annotated[AsyncSession, Depends(get_db)]
hasher = PasswordHasher()
DUMMY_HASH = hasher.hash(secrets.token_urlsafe(32))
_attempts: dict[str, deque[float]] = defaultdict(deque)


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def check_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin and origin != settings.app_origin:
        raise HTTPException(403, "Request origin is not allowed")


def rate_limit(request: Request) -> None:
    # Single API process; never trust client-supplied forwarding headers.
    key = f"{request.client.host if request.client else 'local'}:{request.url.path}"
    now = monotonic()
    for old_key in list(_attempts):
        if not _attempts[old_key] or _attempts[old_key][-1] < now - 900:
            del _attempts[old_key]
    attempts = _attempts[key]
    while attempts and attempts[0] < now - 900:
        attempts.popleft()
    if len(attempts) >= 20:
        raise HTTPException(429, "Too many attempts. Please try again in 15 minutes.")
    attempts.append(now)


async def current_user(request: Request, db: DB) -> User:
    token = request.cookies.get("avenor_session", "")
    session = await db.get(Session, digest(token))
    if not session or session.expires_at < datetime.now(UTC):
        raise HTTPException(401, "Please sign in to continue")
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        check_origin(request)
        csrf = request.headers.get("x-csrf-token", "")
        if not csrf or not hmac.compare_digest(session.csrf_hash, digest(csrf)):
            raise HTTPException(403, "Invalid CSRF token. Refresh the page and try again.")
    user = await db.get(User, session.user_id)
    if not user:
        raise HTTPException(401, "Session expired")
    return user


CurrentUser = Annotated[User, Depends(current_user)]


async def membership(workspace_id: str, request: Request, user: CurrentUser, db: DB) -> Member:
    member = await db.get(Member, (workspace_id, user.id))
    if not member:
        raise HTTPException(404, "Workspace not found")
    if request.method not in ("GET", "HEAD", "OPTIONS") and member.role == "viewer":
        # Query and export are read operations despite using POST.
        if not request.url.path.endswith(("/analytics/query", "/analytics/export")):
            raise HTTPException(403, "Editor access is required")
    return member


Membership = Annotated[Member, Depends(membership)]


def require_admin(member: Member) -> None:
    if member.role not in ("owner", "admin"):
        raise HTTPException(403, "Workspace admin access is required")
