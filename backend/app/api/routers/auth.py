from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.models.core import User, Employee, VerificationToken
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.core.limiter import limiter
import uuid
import os
from datetime import datetime, timedelta, timezone
import json
import base64
import logging
import secrets
import hashlib
from jose import jwt, JWTError

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

EMAIL_VERIFY_PURPOSE = "email-verification"


async def _create_verification_token(db: AsyncSession, user_id: str) -> str:
    """
    Generate a cryptographically secure, expiring, single-use verification token.
    Stores the SHA-256 hash in the verification_tokens database table.
    """
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    token_record = VerificationToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
        used_at=None,
    )
    db.add(token_record)
    await db.commit()
    return raw_token


def _decode_legacy_jwt(token: str) -> str:
    """Fallback decoder for legacy signed JWT tokens."""
    try:
        payload = jwt.decode(token, settings.AUTH_SECRET, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link is invalid or has expired. Please request a new one.",
        )
    if payload.get("purpose") != EMAIL_VERIFY_PURPOSE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link is invalid or has expired. Please request a new one.",
        )
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link is invalid.",
        )
    return user_id


async def _send_verification_email(
    db: AsyncSession, email: str, first_name: str, user_id: str
) -> None:
    """
    Send a Resend verification email with a secure, expiring, single-use token.
    Never exposes internal exceptions to callers.
    """
    if not settings.RESEND_API_KEY:
        logger.warning(
            "RESEND_API_KEY not configured. Skipping verification email to %s.", email
        )
        return

    try:
        import resend
        resend.api_key = settings.RESEND_API_KEY
        token = await _create_verification_token(db, user_id)
        verify_url = f"{settings.effective_frontend_url}/verify-email?token={token}"

        from_email = settings.RESEND_FROM_EMAIL
        email_payload = {
            "from": from_email,
            "to": email,
            "subject": "Verify your Maple Intranet account",
            "html": (
                f"<div style='font-family:sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;'>"
                f"<h2 style='color:#0f766e;'>Welcome to Maple Intranet, {first_name}!</h2>"
                f"<p style='color:#334155;'>Please confirm your email address to activate your account. "
                f"This single-use link expires in <strong>24 hours</strong>.</p>"
                f"<p style='margin:28px 0;'>"
                f"<a href='{verify_url}' style='display:inline-block;padding:12px 28px;"
                f"background:#0d9488;color:#ffffff;border-radius:8px;text-decoration:none;"
                f"font-weight:600;'>Verify My Email</a>"
                f"</p>"
                f"<p style='color:#64748b;font-size:13px;'>Or copy this URL into your browser:</p>"
                f"<p style='color:#0d9488;font-size:12px;word-break:break-all;'>{verify_url}</p>"
                f"<hr style='border:none;border-top:1px solid #e2e8f0;margin:24px 0;' />"
                f"<p style='color:#94a3b8;font-size:12px;'>If you did not create this account, no action is needed.</p>"
                f"</div>"
            ),
        }

        try:
            resend.Emails.send(email_payload)
            logger.info("Verification email sent to %s via %s", email, from_email)
        except Exception as send_err:
            logger.error("Resend delivery failed to %s from %s: %s", email, from_email, send_err)
    except Exception as exc:
        logger.warning("Failed to prepare or send verification email to %s: %s", email, exc)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class AdminVerifyRequest(BaseModel):
    user_id: str


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(select(User).where(User.email == credentials.email))
        user = result.scalars().first()

        # Always check user existence and status first
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        # Check password before revealing verification status (prevents email enumeration)
        if not verify_password(credentials.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        # Explicitly block unverified accounts
        if not user.email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Your email address has not been verified. "
                    "Please check your inbox for the verification link, "
                    "or use 'Resend verification email' on the sign-in page."
                ),
            )

        access_token = create_access_token(subject=user.id)
        roles = [user.role]

        emp_result = await db.execute(select(Employee).where(Employee.id == user.id))
        employee = emp_result.scalars().first()
        onboarding_completed = employee.onboarding_completed if employee else False
        navigation_tour_completed = employee.navigation_tour_completed if employee else False

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "roles": roles,
                "onboarding_completed": onboarding_completed,
                "navigation_tour_completed": navigation_tour_completed,
            },
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error during login for %s", credentials.email)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during sign in. Please try again.",
        )


@router.post("/signup")
@limiter.limit("5/minute")
async def signup(
    request: Request,
    user_in: SignupRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(select(User).where(User.email == user_in.email))
        existing = result.scalars().first()
        if existing:
            # If account exists but email is unverified, resend verification safely
            if not existing.email_verified:
                await _send_verification_email(db, existing.email, existing.first_name, existing.id)
                return {
                    "message": (
                        "An account with this email is pending verification. "
                        "We have resent the verification link. Please check your inbox."
                    ),
                    "requires_verification": True,
                    "pending_verification": True,
                }
            # Already verified
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists. Please sign in.",
            )

        user_id = str(uuid.uuid4())
        new_user = User(
            id=user_id,
            email=user_in.email,
            password_hash=get_password_hash(user_in.password),
            first_name=user_in.first_name,
            last_name=user_in.last_name,
            is_active=True,
            email_verified=False,
        )
        new_employee = Employee(
            id=user_id,
            onboarding_completed=False,
            onboarding_step=1,
            designation="",
        )
        db.add(new_user)
        db.add(new_employee)
        await db.commit()

        if settings.RESEND_API_KEY:
            await _send_verification_email(db, user_in.email, user_in.first_name, user_id)
            return {
                "message": (
                    "Account created! We've sent a verification link to your email. "
                    "Please verify your address before signing in."
                ),
                "requires_verification": True,
                "pending_verification": False,
            }
        else:
            # Development fallback when RESEND_API_KEY is not configured
            logger.warning(
                "RESEND_API_KEY not configured — auto-verifying %s for local development.",
                user_in.email,
            )
            result_u = await db.execute(select(User).where(User.id == user_id))
            created_user = result_u.scalars().first()
            if created_user:
                created_user.email_verified = True
                await db.commit()
            return {
                "message": "Account created and auto-verified (dev mode). You can sign in now.",
                "requires_verification": False,
                "pending_verification": False,
            }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error during signup for %s", user_in.email)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating your account. Please try again later.",
        )


@router.get("/verify-email")
@limiter.limit("20/minute")
async def verify_email_status(
    request: Request,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Read-only inspection endpoint.
    NEVER marks an account as verified merely because a link was opened.
    Protects against automated email security bots and pre-fetch crawlers.
    """
    clean_token = token.strip()
    token_hash = hashlib.sha256(clean_token.encode("utf-8")).hexdigest()
    stmt = select(VerificationToken).where(VerificationToken.token_hash == token_hash)
    result = await db.execute(stmt)
    tok = result.scalars().first()

    if tok:
        if tok.used_at is not None:
            return {"status": "already_used", "message": "This verification token has already been used."}
        now = datetime.now(timezone.utc)
        if now > tok.expires_at:
            return {"status": "expired", "message": "This verification link has expired."}
        return {"status": "valid", "message": "Verification link is valid. Click Confirm to complete verification."}

    # Check legacy signed JWT
    try:
        _decode_legacy_jwt(clean_token)
        return {"status": "valid", "message": "Verification link is valid. Click Confirm to complete verification."}
    except HTTPException:
        return {"status": "invalid", "message": "This verification link is invalid or has expired."}


@router.post("/verify-email")
@limiter.limit("20/minute")
async def verify_email_confirm(
    request: Request,
    body: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Confirm email verification via user action (POST).
    - Single-use token enforcement: Rejects previously used tokens.
    - Expiration check: Rejects expired tokens.
    - Idempotent UX: Safely informs user if account is already verified.
    """
    clean_token = body.token.strip()
    if not clean_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token is required.",
        )

    token_hash = hashlib.sha256(clean_token.encode("utf-8")).hexdigest()
    stmt = select(VerificationToken).where(VerificationToken.token_hash == token_hash)
    result = await db.execute(stmt)
    tok = result.scalars().first()

    user_id = None
    if tok:
        if tok.used_at is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This verification token has already been used. Please request a new one if needed.",
            )
        now = datetime.now(timezone.utc)
        if now > tok.expires_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This verification link has expired. Please request a new one.",
            )
        user_id = tok.user_id
    else:
        # Fallback to legacy signed JWT
        user_id = _decode_legacy_jwt(clean_token)

    u_result = await db.execute(select(User).where(User.id == user_id))
    user = u_result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link is invalid.",
        )

    if user.email_verified:
        if tok and tok.used_at is None:
            tok.used_at = datetime.now(timezone.utc)
            await db.commit()
        return {
            "message": "Your email is already verified. You can sign in.",
            "already_verified": True,
        }

    # Mark user verified and consume token (single-use)
    user.email_verified = True
    if tok:
        tok.used_at = datetime.now(timezone.utc)
    await db.commit()
    logger.info("Email verified for user %s (%s)", user.id, user.email)

    return {
        "message": "Email verified successfully! You can now sign in.",
        "already_verified": False,
    }


@router.post("/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(
    request: Request,
    body: ResendVerificationRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Resend verification link. Always returns a generic success message
    to prevent user enumeration. Silently skips if already verified.
    """
    try:
        result = await db.execute(select(User).where(User.email == body.email))
        user = result.scalars().first()

        if user and not user.email_verified:
            await _send_verification_email(db, user.email, user.first_name, user.id)

        return {
            "message": (
                "If an account with this email is pending verification, we've resent the link. "
                "Please check your inbox."
            )
        }
    except Exception:
        logger.exception("Error during resend_verification for %s", body.email)
        return {
            "message": (
                "If an account with this email is pending verification, we've resent the link. "
                "Please check your inbox."
            )
        }


@router.post("/admin/verify-user")
async def admin_verify_user(
    body: AdminVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Admin utility to manually verify an existing employee account.
    """
    result = await db.execute(select(User).where(User.id == body.user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.email_verified = True
    await db.commit()
    return {"message": f"User {user.email} has been manually verified."}



# ---------------------------------------------------------------------------
# Google OAuth endpoints (unchanged)
# ---------------------------------------------------------------------------

GOOGLE_CLIENT_ID = settings.GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET = settings.GOOGLE_CLIENT_SECRET
FRONTEND_URL = settings.FRONTEND_URL


def get_redirect_uri(request: Request):
    base_url = str(request.base_url).rstrip("/")
    return f"{base_url}/api/v1/auth/google/callback"


@router.get("/google/login")
async def google_login(request: Request, user_id: str):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google Client ID not configured")

    redirect_uri = get_redirect_uri(request)
    state_dict = {"user_id": user_id, "frontend_url": request.headers.get("referer", FRONTEND_URL)}
    state = base64.urlsafe_b64encode(json.dumps(state_dict).encode()).decode()

    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        "response_type=code&"
        "scope=https://www.googleapis.com/auth/calendar.readonly%20https://www.googleapis.com/auth/calendar.events&"
        "access_type=offline&"
        "prompt=consent&"
        f"state={state}"
    )
    return RedirectResponse(auth_url)


@router.get("/google/callback")
async def google_callback(request: Request, code: str = None, state: str = None, error: str = None):
    if error:
        return RedirectResponse(f"{FRONTEND_URL}/calendar?error={error}")

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")

    try:
        state_dict = json.loads(base64.urlsafe_b64decode(state.encode()).decode())
        user_id = state_dict.get("user_id")
        frontend_url = state_dict.get("frontend_url", FRONTEND_URL).rstrip("/")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    redirect_uri = get_redirect_uri(request)
    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=data)
        token_data = response.json()

    if "error" in token_data:
        return RedirectResponse(f"{frontend_url}/calendar?error=oauth_failed")

    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in", 3600)
    expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

    async for db in get_db():
        update_data = {
            "google_access_token": access_token,
            "google_token_expires_at": expires_at,
        }
        if refresh_token:
            update_data["google_refresh_token"] = refresh_token
        await db.execute(update(User).where(User.id == user_id).values(**update_data))
        await db.commit()
        break

    return RedirectResponse(f"{frontend_url}/calendar?connected=true")


@router.get("/google/status")
async def google_status(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "is_connected": bool(user.google_access_token or user.google_refresh_token),
        "expires_at": user.google_token_expires_at,
    }
