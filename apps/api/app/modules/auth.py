import secrets
import smtplib
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage

from argon2.exceptions import VerificationError
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.security import DB, DUMMY_HASH, CurrentUser, check_origin, digest, hasher, rate_limit
from app.db.models import PasswordReset, Session, User
from app.modules.schemas import (
    LoginIn,
    Message,
    PasswordIn,
    ProfileIn,
    ProfileOut,
    RegisterIn,
    ResetIn,
    ResetRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


async def establish_session(user: User, response: Response, db: DB) -> None:
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    db.add(Session(token_hash=digest(token), csrf_hash=digest(csrf), user_id=user.id,
                   expires_at=datetime.now(UTC) + timedelta(days=7)))
    response.set_cookie("avenor_session", token, httponly=True, secure=settings.cookie_secure,
                        samesite="lax", max_age=604800, path="/")
    response.set_cookie("avenor_csrf", csrf, secure=settings.cookie_secure, samesite="lax", max_age=604800, path="/")


@router.post("/register", response_model=ProfileOut, status_code=201, dependencies=[Depends(rate_limit), Depends(check_origin)])
async def register(data: RegisterIn, response: Response, db: DB) -> User:
    user = User(email=str(data.email).lower(), name=data.name.strip(), password_hash=await run_in_threadpool(hasher.hash, data.password))
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(409, "An account with this email already exists") from exc
    await establish_session(user, response, db)
    return user


@router.post("/login", response_model=ProfileOut, dependencies=[Depends(rate_limit), Depends(check_origin)])
async def login(data: LoginIn, response: Response, db: DB) -> User:
    user = await db.scalar(select(User).where(User.email == str(data.email).lower()))
    try:
        await run_in_threadpool(hasher.verify, user.password_hash if user else DUMMY_HASH, data.password)
    except VerificationError as exc:
        raise HTTPException(401, "Email or password is incorrect") from exc
    if not user:
        raise HTTPException(401, "Email or password is incorrect")
    await establish_session(user, response, db)
    return user


@router.get("/me", response_model=ProfileOut)
async def me(user: CurrentUser) -> User:
    return user


@router.patch("/me", response_model=ProfileOut)
async def profile(data: ProfileIn, user: CurrentUser) -> User:
    valid = {"theme": {"light", "dark", "system"}, "date_format": {"iso", "us", "eu"}, "number_format": {"en-US", "de-DE"}}
    if any(value not in valid[key] for key, value in data.preferences.items()):
        raise HTTPException(422, "Unsupported preference")
    user.name = data.name.strip()
    user.preferences = {**user.preferences, **{str(k): v for k, v in data.preferences.items()}}
    return user


@router.post("/logout", response_model=Message)
async def logout(request: Request, response: Response, user: CurrentUser, db: DB) -> Message:
    await db.execute(delete(Session).where(Session.token_hash == digest(request.cookies.get("avenor_session", ""))))
    response.delete_cookie("avenor_session", path="/")
    response.delete_cookie("avenor_csrf", path="/")
    return Message(message="Signed out")


@router.post("/password", response_model=Message)
async def change_password(data: PasswordIn, response: Response, user: CurrentUser, db: DB) -> Message:
    try:
        await run_in_threadpool(hasher.verify, user.password_hash, data.current_password)
    except VerificationError as exc:
        raise HTTPException(400, "Current password is incorrect") from exc
    user.password_hash = await run_in_threadpool(hasher.hash, data.new_password)
    await db.execute(delete(Session).where(Session.user_id == user.id))
    await establish_session(user, response, db)
    return Message(message="Password changed; other sessions signed out")


@router.post("/forgot-password", response_model=Message, dependencies=[Depends(rate_limit), Depends(check_origin)])
async def forgot(data: ResetRequest, db: DB) -> Message:
    user = await db.scalar(select(User).where(User.email == str(data.email).lower()))
    if user:
        token = secrets.token_urlsafe(32)
        await db.execute(delete(PasswordReset).where(PasswordReset.user_id == user.id))
        db.add(PasswordReset(token_hash=digest(token), user_id=user.id, expires_at=datetime.now(UTC) + timedelta(minutes=30)))
        message = EmailMessage()
        message["Subject"] = "Reset your Avenor password"
        message["From"] = "Avenor <no-reply@avenor.local>"
        message["To"] = user.email
        message.set_content(f"Reset your password within 30 minutes:\n{settings.app_origin}/reset-password?token={token}")
        def send() -> None:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                smtp.send_message(message)
        try:
            await run_in_threadpool(send)
        except (OSError, smtplib.SMTPException) as exc:
            raise HTTPException(503, "Password reset mail service is unavailable") from exc
    return Message(message="If that account exists, a reset link has been sent. Local development mail is available in Mailpit.")


@router.post("/reset-password", response_model=Message, dependencies=[Depends(rate_limit), Depends(check_origin)])
async def reset(data: ResetIn, db: DB) -> Message:
    reset_token = await db.scalar(select(PasswordReset).where(PasswordReset.token_hash == digest(data.token)).with_for_update())
    if not reset_token or reset_token.expires_at < datetime.now(UTC):
        raise HTTPException(400, "Reset link is invalid or expired")
    user = await db.get(User, reset_token.user_id)
    if not user:
        raise HTTPException(400, "Invalid reset link")
    user.password_hash = await run_in_threadpool(hasher.hash, data.password)
    await db.execute(delete(Session).where(Session.user_id == user.id))
    await db.delete(reset_token)
    return Message(message="Password updated. You can now sign in.")
