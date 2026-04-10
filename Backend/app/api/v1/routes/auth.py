import secrets
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.config import settings
from app.core.security import create_access_token
from app.database import get_db
from app.services.auth_service import AuthService
from app.services.email_service import EmailService
from models.user import User
from schemas.user import (
    ActivationResponse,
    LoginRequest,
    RegisterResponse,
    ResendActivationRequest,
    Token,
    UserCreate,
    UserResponse,
)

router = APIRouter()
COOKIE_MAX_AGE_SECONDS = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


def _build_activation_link(token: str) -> str:
    base = settings.BACKEND_PUBLIC_URL.rstrip("/")
    return f"{base}/api/v1/auth/activate?token={quote(token)}"


async def _send_activation_email_or_raise(user: User, activation_token: str) -> None:
    email_service = EmailService()
    try:
        await email_service.send_activation_email(
            recipient_email=user.email,
            first_name=user.first_name,
            activation_link=_build_activation_link(activation_token),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Не удалось отправить письмо с подтверждением. Проверьте настройки SMTP и повторите попытку.",
        ) from exc


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    try:
        user, activation_token = await service.register(user_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    activation_required = bool(activation_token)
    if activation_required and activation_token:
        try:
            await _send_activation_email_or_raise(user=user, activation_token=activation_token)
        except HTTPException:
            await service.delete_inactive_user(user.id)
            raise

    return RegisterResponse(
        message="Account created successfully" if not activation_required else "Check your email to activate account",
        user_id=user.id,
        activation_required=activation_required,
    )


@router.post("/resend-activation", response_model=ActivationResponse)
async def resend_activation_email(payload: ResendActivationRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    try:
        user, activation_token = await service.recreate_activation_token(payload.email)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await _send_activation_email_or_raise(user=user, activation_token=activation_token)
    return ActivationResponse(message="Activation email sent")


@router.post("/login", response_model=Token)
async def login(
    form_data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    try:
        user = await service.authenticate(form_data.email, form_data.password)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    csrf_token = secrets.token_urlsafe(32)

    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=access_token,
        max_age=COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
        domain=settings.COOKIE_DOMAIN,
    )
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=csrf_token,
        max_age=COOKIE_MAX_AGE_SECONDS,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
        domain=settings.COOKIE_DOMAIN,
    )

    return Token(
        access_token=None,
        token_type="cookie",
        user=UserResponse.model_validate(user),
    )


@router.get("/activate", response_model=ActivationResponse)
async def activate_account(token: str, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    try:
        await service.activate_account(token)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ActivationResponse(message="Account successfully activated")


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        path="/",
        domain=settings.COOKIE_DOMAIN,
    )
    response.delete_cookie(
        key=settings.CSRF_COOKIE_NAME,
        path="/",
        domain=settings.COOKIE_DOMAIN,
    )
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: User = Depends(get_current_active_user),
):
    return UserResponse.model_validate(current_user)
