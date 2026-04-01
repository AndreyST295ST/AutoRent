import uuid
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import get_password_hash, verify_password
from models.user import ActivationToken, Client, User, UserStatus
from schemas.user import UserCreate


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, user_data: UserCreate) -> tuple[User, str]:
        result = await self.db.execute(select(User).where(User.email == user_data.email))
        if result.scalar_one_or_none():
            raise ValueError("Email already exists")

        user = User(
            email=user_data.email,
            password_hash=get_password_hash(user_data.password),
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            phone=user_data.phone,
            status=UserStatus.INACTIVE,
        )
        self.db.add(user)
        await self.db.flush()

        self.db.add(Client(user_id=user.id))

        token = str(uuid.uuid4())
        activation_token = ActivationToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(hours=settings.ACTIVATION_TOKEN_EXPIRE_HOURS),
        )
        self.db.add(activation_token)

        await self.db.commit()
        await self.db.refresh(user)
        return user, token

    async def activate_account(self, token: str) -> User:
        result = await self.db.execute(
            select(ActivationToken).where(
                ActivationToken.token == token,
                ActivationToken.is_used.is_(False),
                ActivationToken.expires_at > datetime.utcnow(),
            )
        )
        activation_token = result.scalar_one_or_none()
        if not activation_token:
            raise ValueError("Activation token is invalid or expired")

        user = await self.db.get(User, activation_token.user_id)
        if not user:
            raise ValueError("User not found")

        user.status = UserStatus.ACTIVE
        activation_token.is_used = True
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def authenticate(self, email: str, password: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user or not verify_password(password, user.password_hash):
            return None

        if user.status != UserStatus.ACTIVE:
            raise ValueError("Account is not activated")

        return user

