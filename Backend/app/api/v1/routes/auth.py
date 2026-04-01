from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.core.security import create_access_token
from app.database import get_db
from app.services.auth_service import AuthService
from models.user import User
from schemas.user import (
    ActivationResponse,
    LoginRequest,
    RegisterResponse,
    Token,
    UserCreate,
    UserResponse,
)

router = APIRouter()


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    try:
        user, activation_token = await service.register(user_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return RegisterResponse(
        message="Check your email to activate account",
        user_id=user.id,
        activation_token=activation_token,
    )


@router.post("/login", response_model=Token)
async def login(form_data: LoginRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    try:
        user = await service.authenticate(form_data.email, form_data.password)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    return Token(
        access_token=access_token,
        token_type="bearer",
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
async def logout():
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: User = Depends(get_current_active_user),
):
    return UserResponse.model_validate(current_user)

