from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from app.api.v1.router import api_router
from app.database import AsyncSessionLocal, Base, engine
from app.services.auth_service import AuthService
from models import booking, car, document, review, user  # noqa: F401

app = FastAPI(title="AutoRent API")
uploads_dir = Path("uploads")
uploads_dir.mkdir(parents=True, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5500",
        "https://autorent.ru",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.on_event("startup")
async def startup():
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
