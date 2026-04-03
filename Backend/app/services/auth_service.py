import uuid
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import get_password_hash, verify_password
from models.user import ActivationToken, Client, User, UserRole, UserStatus
from schemas.user import UserCreate

LEGACY_DEMO_ADMIN_EMAIL = "admin@autorent.local"


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, user_data: UserCreate) -> tuple[User, str | None]:
        result = await self.db.execute(select(User).where(User.email == user_data.email))
        if result.scalar_one_or_none():
            raise ValueError("Email already exists")

        requires_activation = bool(settings.REQUIRE_EMAIL_ACTIVATION)

        user = User(
            email=user_data.email,
            password_hash=get_password_hash(user_data.password),
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            phone=user_data.phone,
            status=UserStatus.INACTIVE if requires_activation else UserStatus.ACTIVE,
        )
        self.db.add(user)
        await self.db.flush()

        self.db.add(Client(user_id=user.id))

        token: str | None = None
        if requires_activation:
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

    async def ensure_demo_admin(self) -> None:
        if not settings.ENABLE_DEMO_ADMIN:
            return

        demo_admin_email = settings.DEMO_ADMIN_EMAIL.strip().lower()
        demo_admin_password = settings.DEMO_ADMIN_PASSWORD

        legacy_result = await self.db.execute(
            select(User).where(func.lower(User.email) == LEGACY_DEMO_ADMIN_EMAIL.lower())
        )
        legacy_admin = legacy_result.scalar_one_or_none()

        result = await self.db.execute(
            select(User).where(func.lower(User.email) == demo_admin_email)
        )
        admin = result.scalar_one_or_none()
        password_hash = get_password_hash(demo_admin_password)
        changed = False

        # Migrate accidental legacy demo admin email from old builds.
        if legacy_admin and admin:
            await self.db.delete(legacy_admin)
            await self.db.flush()
            changed = True
        elif legacy_admin and not admin:
            legacy_admin.email = demo_admin_email
            admin = legacy_admin
            changed = True

        if admin is None:
            admin = User(
                email=demo_admin_email,
                password_hash=password_hash,
                first_name="Admin",
                last_name="Demo",
                role=UserRole.ADMIN,
                status=UserStatus.ACTIVE,
            )
            self.db.add(admin)
            await self.db.commit()
            return

        if admin.role != UserRole.ADMIN:
            admin.role = UserRole.ADMIN
            changed = True
        if admin.status != UserStatus.ACTIVE:
            admin.status = UserStatus.ACTIVE
            changed = True
        if not verify_password(demo_admin_password, admin.password_hash):
            admin.password_hash = password_hash
            changed = True

        if changed:
            await self.db.commit()

    async def authenticate(self, email: str, password: str) -> User | None:
        identifier = (email or "").strip()
        if not identifier:
            return None

        if settings.ENABLE_DEMO_ADMIN:
            if identifier.lower() == settings.DEMO_ADMIN_LOGIN.strip().lower():
                identifier = settings.DEMO_ADMIN_EMAIL.strip()

        result = await self.db.execute(
            select(User).where(func.lower(User.email) == identifier.lower())
        )
        user = result.scalar_one_or_none()
        if not user or not verify_password(password, user.password_hash):
            return None

        if user.status != UserStatus.ACTIVE:
            raise ValueError("Account is not activated")

        return user
