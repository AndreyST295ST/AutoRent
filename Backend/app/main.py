from pathlib import Path
import warnings

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from app.api.v1.router import api_router
from app.config import settings
from app.database import AsyncSessionLocal, Base, engine
from app.services.auth_service import AuthService
from models import booking, car, document, review, user  # noqa: F401

app = FastAPI(title="AutoRent API")
uploads_dir = Path("uploads")
uploads_dir.mkdir(parents=True, exist_ok=True)
(uploads_dir / "cars").mkdir(parents=True, exist_ok=True)

def _build_cors_origins() -> list[str]:
    raw = [item.strip() for item in (settings.CORS_ORIGINS or "").split(",") if item.strip()]
    if settings.FRONTEND_URL:
        raw.append(settings.FRONTEND_URL.rstrip("/"))
    # Keep order stable while removing duplicates.
    seen: set[str] = set()
    prepared: list[str] = []
    for origin in raw:
        if origin in seen:
            continue
        seen.add(origin)
        prepared.append(origin)
    return prepared

app.add_middleware(
    CORSMiddleware,
    allow_origins=_build_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", settings.CSRF_HEADER_NAME],
)

app.include_router(api_router, prefix="/api/v1")
app.mount("/uploads/cars", StaticFiles(directory=uploads_dir / "cars"), name="uploads-cars")


@app.on_event("startup")
async def startup():
    if settings.COOKIE_SAMESITE == "none" and not settings.COOKIE_SECURE:
        raise RuntimeError("РџСЂРё COOKIE_SAMESITE=none РїР°СЂР°РјРµС‚СЂ COOKIE_SECURE РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ True")
    if settings.ENABLE_DEMO_ADMIN and not settings.DEBUG:
        warnings.warn(
            "ENABLE_DEMO_ADMIN=True РїСЂРё РІС‹РєР»СЋС‡РµРЅРЅРѕРј DEBUG. РћС‚РєР»СЋС‡РёС‚Рµ СЌС‚Сѓ РЅР°СЃС‚СЂРѕР№РєСѓ РґР»СЏ production.",
            RuntimeWarning,
            stacklevel=1,
        )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        has_photo_urls = await conn.run_sync(
            lambda sync_conn: any(
                column["name"] == "photo_urls"
                for column in inspect(sync_conn).get_columns("cars")
            )
        )

        if not has_photo_urls:
            if conn.dialect.name == "postgresql":
                await conn.execute(
                    text("ALTER TABLE cars ADD COLUMN photo_urls JSON NOT NULL DEFAULT '[]'::json")
                )
            else:
                await conn.execute(
                    text("ALTER TABLE cars ADD COLUMN photo_urls JSON NOT NULL DEFAULT '[]'")
                )

        car_extra_columns: dict[str, str] = {
            "fuel_grade": "VARCHAR(20)",
            "body_type": "VARCHAR(20)",
            "drive_type": "VARCHAR(20)",
            "doors": "INTEGER",
        }
        for column_name, column_type in car_extra_columns.items():
            has_column = await conn.run_sync(
                lambda sync_conn, name=column_name: any(
                    column["name"] == name for column in inspect(sync_conn).get_columns("cars")
                )
            )
            if not has_column:
                await conn.execute(text(f"ALTER TABLE cars ADD COLUMN {column_name} {column_type}"))

        has_passport_scan_urls = await conn.run_sync(
            lambda sync_conn: any(
                column["name"] == "passport_scan_urls"
                for column in inspect(sync_conn).get_columns("client_documents")
            )
        )
        has_license_scan_urls = await conn.run_sync(
            lambda sync_conn: any(
                column["name"] == "license_scan_urls"
                for column in inspect(sync_conn).get_columns("client_documents")
            )
        )

        if not has_passport_scan_urls:
            if conn.dialect.name == "postgresql":
                await conn.execute(
                    text(
                        "ALTER TABLE client_documents "
                        "ADD COLUMN passport_scan_urls JSON NOT NULL DEFAULT '[]'::json"
                    )
                )
            else:
                await conn.execute(
                    text(
                        "ALTER TABLE client_documents "
                        "ADD COLUMN passport_scan_urls JSON NOT NULL DEFAULT '[]'"
                    )
                )

        if not has_license_scan_urls:
            if conn.dialect.name == "postgresql":
                await conn.execute(
                    text(
                        "ALTER TABLE client_documents "
                        "ADD COLUMN license_scan_urls JSON NOT NULL DEFAULT '[]'::json"
                    )
                )
            else:
                await conn.execute(
                    text(
                        "ALTER TABLE client_documents "
                        "ADD COLUMN license_scan_urls JSON NOT NULL DEFAULT '[]'"
                    )
                )

    async with AsyncSessionLocal() as session:
        await AuthService(session).ensure_demo_admin()


@app.get("/health")
async def health():
    return {"status": "ok"}
