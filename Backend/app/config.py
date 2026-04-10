import secrets

from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
from typing import Optional

class Settings(BaseSettings):
    APP_NAME: str = "AutoRent API"
    DEBUG: bool = False
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ACTIVATION_TOKEN_EXPIRE_HOURS: int = 24
    REQUIRE_EMAIL_ACTIVATION: bool = False

    ENABLE_DEMO_ADMIN: bool = False
    DEMO_ADMIN_LOGIN: str = "admin"
    DEMO_ADMIN_EMAIL: str = "admin@autorent.ru"
    DEMO_ADMIN_PASSWORD: str = "admin"

    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/autorent"
    SQL_ECHO: bool = False

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_STARTTLS: bool = True
    SMTP_USE_TLS: bool = False
    EMAIL_FROM: str = "noreply@autorent.ru"

    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_PUBLIC_URL: str = "http://localhost:8001"
    AUTH_COOKIE_NAME: str = "access_token"
    CSRF_COOKIE_NAME: str = "csrf_token"
    CSRF_HEADER_NAME: str = "X-CSRF-Token"
    COOKIE_SECURE: bool = True
    COOKIE_SAMESITE: str = "lax"
    COOKIE_DOMAIN: Optional[str] = None
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    MAX_DOCUMENT_FILE_SIZE_MB: int = 10
    MAX_CAR_PHOTO_FILE_SIZE_MB: int = 10
    MAX_CAR_PHOTOS_PER_UPLOAD: int = 8

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug_value(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "prod", "production"}:
                return False
        return value

    @field_validator("COOKIE_SECURE", mode="before")
    @classmethod
    def parse_cookie_secure(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on"}:
                return True
            if normalized in {"0", "false", "no", "off"}:
                return False
        return value

    @field_validator("COOKIE_SAMESITE", mode="before")
    @classmethod
    def normalize_cookie_samesite(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"lax", "strict", "none"}:
                return normalized
        return value

    @field_validator("SQL_ECHO", mode="before")
    @classmethod
    def parse_sql_echo(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on"}:
                return True
            if normalized in {"0", "false", "no", "off"}:
                return False
        return value

    @field_validator("SMTP_STARTTLS", "SMTP_USE_TLS", mode="before")
    @classmethod
    def parse_smtp_bool(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on"}:
                return True
            if normalized in {"0", "false", "no", "off"}:
                return False
        return value

    @field_validator("REQUIRE_EMAIL_ACTIVATION", mode="before")
    @classmethod
    def parse_require_activation(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on"}:
                return True
            if normalized in {"0", "false", "no", "off"}:
                return False
        return value

    @field_validator("ENABLE_DEMO_ADMIN", mode="before")
    @classmethod
    def parse_enable_demo_admin(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on"}:
                return True
            if normalized in {"0", "false", "no", "off"}:
                return False
        return value

    @field_validator("MAX_DOCUMENT_FILE_SIZE_MB", "MAX_CAR_PHOTO_FILE_SIZE_MB", "MAX_CAR_PHOTOS_PER_UPLOAD")
    @classmethod
    def validate_positive_ints(cls, value):
        if int(value) <= 0:
            raise ValueError("\u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435 \u0434\u043e\u043b\u0436\u043d\u043e \u0431\u044b\u0442\u044c \u0431\u043e\u043b\u044c\u0448\u0435 0")
        return int(value)

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, value):
        stripped = str(value or "").strip()
        if not stripped:
            return secrets.token_urlsafe(48)
        if len(stripped) < 32:
            raise ValueError("SECRET_KEY \u0434\u043e\u043b\u0436\u0435\u043d \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u0442\u044c \u043c\u0438\u043d\u0438\u043c\u0443\u043c 32 \u0441\u0438\u043c\u0432\u043e\u043b\u0430")
        if "change_me" in stripped.lower():
            raise ValueError("\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u0440\u0435\u0430\u043b\u044c\u043d\u043e\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 SECRET_KEY")
        return stripped

    class Config:
        env_file = ".env"
        case_sensitive = True

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()

