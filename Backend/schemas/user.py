from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from models.user import UserRole, UserStatus


class UserBase(BaseModel):
    email: EmailStr
    first_name: str = Field(..., min_length=2, max_length=50)
    last_name: str = Field(..., min_length=2, max_length=50)
    phone: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=1)


class ResendActivationRequest(BaseModel):
    email: EmailStr


class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, min_length=2, max_length=50)
    last_name: Optional[str] = Field(default=None, min_length=2, max_length=50)
    phone: Optional[str] = None


class UserStatusUpdate(BaseModel):
    status: UserStatus


class UserResponse(UserBase):
    id: int
    role: UserRole
    status: UserStatus
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "cookie"
    user: UserResponse


class RegisterResponse(BaseModel):
    message: str
    user_id: int
    activation_required: bool = False


class ActivationResponse(BaseModel):
    message: str
