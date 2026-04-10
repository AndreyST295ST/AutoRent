import secrets

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import decode_access_token
from app.database import get_db
from models.user import Client, User, UserRole, UserStatus

bearer_scheme = HTTPBearer(auto_error=False)
SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    bearer_token = credentials.credentials if credentials else None
    cookie_token = request.cookies.get(settings.AUTH_COOKIE_NAME)
    token = bearer_token or cookie_token

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется авторизация")

    uses_cookie_auth = bool(cookie_token) and not bearer_token
    if uses_cookie_auth and request.method.upper() not in SAFE_METHODS:
        csrf_cookie = request.cookies.get(settings.CSRF_COOKIE_NAME)
        csrf_header = request.headers.get(settings.CSRF_HEADER_NAME)
        if not csrf_cookie or not csrf_header or not secrets.compare_digest(csrf_cookie, csrf_header):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ошибка проверки CSRF-токена")

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Недействительный токен")

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Недействительный токен") from exc

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Учетная запись не активирована")
    return current_user


def require_roles(*roles: UserRole):
    async def checker(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав",
            )
        return current_user

    return checker


get_admin_user = require_roles(UserRole.ADMIN)
get_employee_or_admin_user = require_roles(UserRole.EMPLOYEE, UserRole.ADMIN)
get_client_user = require_roles(UserRole.CLIENT)


async def get_current_client(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_client_user),
) -> Client:
    result = await db.execute(select(Client).where(Client.user_id == current_user.id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Профиль клиента не найден")
    return client

