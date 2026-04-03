from datetime import datetime
from pathlib import Path
import re
from urllib.parse import quote, unquote
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_active_user,
    get_current_client,
    get_employee_or_admin_user,
)
from app.config import settings
from app.database import get_db
from models.booking import Booking, BookingStatus
from models.car import Car
from models.document import ClientDocument, DocumentStatus, RentalDocument
from models.user import Client, User, UserRole

router = APIRouter()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_DOC_FILES_PER_TYPE = 2
PRIVATE_DOCS_DIR = UPLOAD_DIR / "private" / "documents"
PRIVATE_DOCS_DIR.mkdir(parents=True, exist_ok=True)
CHUNK_SIZE_BYTES = 1024 * 1024
MAX_DOC_FILE_SIZE_BYTES = settings.MAX_DOCUMENT_FILE_SIZE_MB * 1024 * 1024
ALLOWED_DOC_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
ALLOWED_DOC_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}
BOOKING_ID_RE = re.compile(r"_(\d+)\.(?:pdf|html)$", re.IGNORECASE)

ACTIVE_BOOKING_STATUSES = {
    BookingStatus.PENDING_REVIEW,
    BookingStatus.CONFIRMED,
    BookingStatus.ACTIVE,
}


class VerifyDocumentsPayload(BaseModel):
    status: DocumentStatus
    rejection_reason: str | None = None


def _build_document_file_url(storage_relative_path: str) -> str:
    normalized = storage_relative_path.strip().lstrip("/").replace("\\", "/")
    return f"/api/v1/documents/files/{quote(normalized, safe='/')}"


def _extract_storage_relative_path(value: str | None) -> str | None:
    if not value:
        return None
    raw = unquote(str(value)).strip()
    if not raw:
        return None
    if "://" in raw:
        return None

    api_prefix = "/api/v1/documents/files/"
    uploads_prefix = "/uploads/"

    if raw.startswith(api_prefix):
        raw = raw[len(api_prefix) :]
    elif raw.startswith(uploads_prefix):
        raw = raw[len(uploads_prefix) :]

    raw = raw.lstrip("/").replace("\\", "/")
    if not raw or raw.startswith(".."):
        return None
    return raw


def _safe_upload_path(storage_relative_path: str) -> Path:
    candidate = (UPLOAD_DIR / storage_relative_path).resolve()
    base = UPLOAD_DIR.resolve()
    if not (candidate == base or base in candidate.parents):
        raise HTTPException(status_code=404, detail="File not found")
    if not candidate.exists() or not candidate.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return candidate


def _extract_booking_id_from_path(storage_relative_path: str) -> int | None:
    match = BOOKING_ID_RE.search(Path(storage_relative_path).name)
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def _validate_document_upload(file: UploadFile) -> str:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    extension = Path(file.filename).suffix.lower()
    if extension not in ALLOWED_DOC_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{extension}'. Allowed: {', '.join(sorted(ALLOWED_DOC_EXTENSIONS))}",
        )

    if file.content_type and file.content_type.lower() not in ALLOWED_DOC_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported content type: {file.content_type}")

    return extension


async def _save_upload(file: UploadFile, suffix: str) -> str:
    extension = _validate_document_upload(file)
    filename = f"{uuid4().hex}_{suffix}{extension}"
    destination = PRIVATE_DOCS_DIR / filename
    written = 0

    try:
        with destination.open("wb") as stream:
            while chunk := await file.read(CHUNK_SIZE_BYTES):
                written += len(chunk)
                if written > MAX_DOC_FILE_SIZE_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File '{file.filename}' exceeds {settings.MAX_DOCUMENT_FILE_SIZE_MB} MB",
                    )
                stream.write(chunk)
    except Exception:
        if destination.exists():
            destination.unlink()
        raise

    return destination.relative_to(UPLOAD_DIR).as_posix()


def _safe_float(value) -> float:
    return float(value) if value is not None else 0.0


def _extract_urls(doc: ClientDocument | None, key: str) -> list[str]:
    if not doc:
        return []

    list_attr = f"{key}_scan_urls"
    single_attr = f"{key}_scan_url"

    raw_list = getattr(doc, list_attr, None)
    if isinstance(raw_list, list):
        cleaned = []
        for raw in raw_list:
            normalized = _extract_storage_relative_path(str(raw))
            if normalized:
                cleaned.append(_build_document_file_url(normalized))
        if cleaned:
            return cleaned

    legacy = getattr(doc, single_attr, None)
    legacy_normalized = _extract_storage_relative_path(legacy)
    if legacy_normalized:
        return [_build_document_file_url(legacy_normalized)]

    return []


def _serialize_document(doc: ClientDocument | None) -> dict:
    if not doc:
        return {
            "verification_status": "not_uploaded",
            "passport_scan_url": None,
            "license_scan_url": None,
            "passport_scan_urls": [],
            "license_scan_urls": [],
            "uploaded_at": None,
            "verified_at": None,
            "rejection_reason": None,
        }

    passport_urls = _extract_urls(doc, "passport")
    license_urls = _extract_urls(doc, "license")

    return {
        "verification_status": doc.verification_status,
        "passport_scan_url": passport_urls[0] if passport_urls else None,
        "license_scan_url": license_urls[0] if license_urls else None,
        "passport_scan_urls": passport_urls,
        "license_scan_urls": license_urls,
        "uploaded_at": doc.uploaded_at,
        "verified_at": doc.verified_at,
        "rejection_reason": doc.rejection_reason,
    }


async def _build_client_entities(db: AsyncSession, client_ids: set[int]) -> dict[int, dict]:
    if not client_ids:
        return {}

    clients_result = await db.execute(select(Client).where(Client.id.in_(client_ids)))
    clients = list(clients_result.scalars().all())
    if not clients:
        return {}

    users_result = await db.execute(select(User).where(User.id.in_([client.user_id for client in clients])))
    users_by_id = {user.id: user for user in users_result.scalars().all()}

    bookings_result = await db.execute(select(Booking).where(Booking.client_id.in_(client_ids)))
    bookings = list(bookings_result.scalars().all())

    stats_by_client: dict[int, dict] = {
        client_id: {
            "total_bookings": 0,
            "active_bookings": 0,
            "completed_bookings": 0,
            "cancelled_bookings": 0,
            "total_spent": 0.0,
        }
        for client_id in client_ids
    }

    for booking in bookings:
        stats = stats_by_client.setdefault(
            booking.client_id,
            {
                "total_bookings": 0,
                "active_bookings": 0,
                "completed_bookings": 0,
                "cancelled_bookings": 0,
                "total_spent": 0.0,
            },
        )
        stats["total_bookings"] += 1
        if booking.status in ACTIVE_BOOKING_STATUSES:
            stats["active_bookings"] += 1
        if booking.status == BookingStatus.RETURNED:
            stats["completed_bookings"] += 1
            stats["total_spent"] += _safe_float(booking.total_price)
        if booking.status in {BookingStatus.CANCELLED, BookingStatus.REJECTED}:
            stats["cancelled_bookings"] += 1

    entities: dict[int, dict] = {}
    for client in clients:
        user = users_by_id.get(client.user_id)
        full_name = None
        if user:
            full_name = f"{user.first_name} {user.last_name}".strip()

        entities[client.id] = {
            "client_id": client.id,
            "user_id": client.user_id,
            "registration_date": client.registration_date,
            "activated_at": client.activated_at,
            "user": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "full_name": full_name,
                "phone": user.phone,
                "role": user.role,
                "status": user.status,
                "created_at": user.created_at,
                "last_login_at": user.last_login_at,
            }
            if user
            else None,
            "stats": stats_by_client.get(client.id)
            or {
                "total_bookings": 0,
                "active_bookings": 0,
                "completed_bookings": 0,
                "cancelled_bookings": 0,
                "total_spent": 0.0,
            },
        }

    return entities


def _collect_raw_document_paths(doc: ClientDocument | None) -> set[str]:
    if not doc:
        return set()

    collected: set[str] = set()
    for attr in ("passport_scan_urls", "license_scan_urls"):
        values = getattr(doc, attr, None)
        if isinstance(values, list):
            for value in values:
                normalized = _extract_storage_relative_path(str(value))
                if normalized:
                    collected.add(normalized)

    for attr in ("passport_scan_url", "license_scan_url"):
        normalized = _extract_storage_relative_path(getattr(doc, attr, None))
        if normalized:
            collected.add(normalized)

    return collected


async def _client_owns_storage_path(
    db: AsyncSession,
    current_user: User,
    storage_relative_path: str,
) -> bool:
    client_result = await db.execute(select(Client).where(Client.user_id == current_user.id))
    current_client = client_result.scalar_one_or_none()
    if not current_client:
        return False

    docs_result = await db.execute(
        select(ClientDocument).where(ClientDocument.client_id == current_client.id)
    )
    docs = docs_result.scalar_one_or_none()
    if storage_relative_path in _collect_raw_document_paths(docs):
        return True

    booking_id = _extract_booking_id_from_path(storage_relative_path)
    if booking_id is None:
        return False

    booking = await db.get(Booking, booking_id)
    if not booking:
        return False
    return booking.client_id == current_client.id


@router.get("/files/{file_path:path}")
async def read_private_file(
    file_path: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    storage_relative_path = _extract_storage_relative_path(file_path)
    if not storage_relative_path:
        raise HTTPException(status_code=404, detail="File not found")

    if current_user.role not in {UserRole.ADMIN, UserRole.EMPLOYEE}:
        allowed = await _client_owns_storage_path(db, current_user, storage_relative_path)
        if not allowed:
            raise HTTPException(status_code=403, detail="Access denied")

    target = _safe_upload_path(storage_relative_path)
    return FileResponse(target)


@router.get("/queue")
async def get_documents_queue(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_employee_or_admin_user),
):
    result = await db.execute(
        select(ClientDocument).order_by(ClientDocument.uploaded_at.desc().nullslast())
    )
    docs = list(result.scalars().all())
    client_entities = await _build_client_entities(db, {doc.client_id for doc in docs})

    rows: list[dict] = []
    for doc in docs:
        serialized = _serialize_document(doc)
        rows.append(
            {
                "client_id": doc.client_id,
                "passport_scan_url": serialized["passport_scan_url"],
                "license_scan_url": serialized["license_scan_url"],
                "passport_scan_urls": serialized["passport_scan_urls"],
                "license_scan_urls": serialized["license_scan_urls"],
                "verification_status": doc.verification_status,
                "uploaded_at": doc.uploaded_at,
                "verified_at": doc.verified_at,
                "rejection_reason": doc.rejection_reason,
                "client": client_entities.get(doc.client_id),
            }
        )
    return rows


@router.get("/client/{client_id}")
async def get_client_entity(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_employee_or_admin_user),
):
    client = await db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    entities = await _build_client_entities(db, {client_id})
    entity = entities.get(client_id) or {
        "client_id": client.id,
        "user_id": client.user_id,
        "registration_date": client.registration_date,
        "activated_at": client.activated_at,
        "user": None,
        "stats": {
            "total_bookings": 0,
            "active_bookings": 0,
            "completed_bookings": 0,
            "cancelled_bookings": 0,
            "total_spent": 0.0,
        },
    }

    doc_result = await db.execute(select(ClientDocument).where(ClientDocument.client_id == client_id))
    document = doc_result.scalar_one_or_none()

    bookings_result = await db.execute(
        select(Booking)
        .where(Booking.client_id == client_id)
        .order_by(Booking.created_at.desc())
    )
    bookings = list(bookings_result.scalars().all())

    car_ids = {booking.car_id for booking in bookings}
    cars_by_id: dict[int, Car] = {}
    if car_ids:
        cars_result = await db.execute(select(Car).where(Car.id.in_(car_ids)))
        cars_by_id = {car.id: car for car in cars_result.scalars().all()}

    entity["documents"] = _serialize_document(document)
    entity["bookings"] = [
        {
            "id": booking.id,
            "car_id": booking.car_id,
            "car": {
                "id": car.id,
                "brand": car.brand,
                "model": car.model,
                "license_plate": car.license_plate,
            }
            if (car := cars_by_id.get(booking.car_id))
            else None,
            "start_date": booking.start_date,
            "end_date": booking.end_date,
            "status": booking.status,
            "total_price": _safe_float(booking.total_price),
            "created_at": booking.created_at,
        }
        for booking in bookings
    ]

    return entity


@router.get("/my")
async def get_my_documents(
    db: AsyncSession = Depends(get_db),
    current_client: Client = Depends(get_current_client),
):
    client_id = current_client.id
    result = await db.execute(select(ClientDocument).where(ClientDocument.client_id == client_id))
    document = result.scalar_one_or_none()
    if not document:
        return {
            "client_id": client_id,
            "status": "not_uploaded",
            "verification_status": "not_uploaded",
            "passport_scan_url": None,
            "license_scan_url": None,
            "passport_scan_urls": [],
            "license_scan_urls": [],
            "verified_at": None,
            "rejection_reason": None,
        }

    serialized = _serialize_document(document)
    return {
        "client_id": document.client_id,
        "passport_scan_url": serialized["passport_scan_url"],
        "license_scan_url": serialized["license_scan_url"],
        "passport_scan_urls": serialized["passport_scan_urls"],
        "license_scan_urls": serialized["license_scan_urls"],
        "verification_status": document.verification_status,
        "verified_at": document.verified_at,
        "rejection_reason": document.rejection_reason,
    }


@router.post("/upload")
async def upload_documents(
    passport: list[UploadFile] = File(...),
    license: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_client: Client = Depends(get_current_client),
):
    passport_files = [file for file in (passport or []) if file and file.filename]
    license_files = [file for file in (license or []) if file and file.filename]

    if not passport_files or not license_files:
        raise HTTPException(status_code=400, detail="Passport and driver license files are required")
    if len(passport_files) > MAX_DOC_FILES_PER_TYPE:
        raise HTTPException(
            status_code=400,
            detail=f"At most {MAX_DOC_FILES_PER_TYPE} passport files are allowed",
        )
    if len(license_files) > MAX_DOC_FILES_PER_TYPE:
        raise HTTPException(
            status_code=400,
            detail=f"At most {MAX_DOC_FILES_PER_TYPE} license files are allowed",
        )

    passport_paths: list[str] = []
    license_paths: list[str] = []

    try:
        for index, file in enumerate(passport_files, start=1):
            passport_paths.append(await _save_upload(file, f"passport_{index}"))
        for index, file in enumerate(license_files, start=1):
            license_paths.append(await _save_upload(file, f"license_{index}"))
    finally:
        for file in passport_files:
            await file.close()
        for file in license_files:
            await file.close()

    client_id = current_client.id
    result = await db.execute(select(ClientDocument).where(ClientDocument.client_id == client_id))
    doc = result.scalar_one_or_none()
    if doc is None:
        doc = ClientDocument(client_id=client_id)
        db.add(doc)

    doc.passport_scan_urls = passport_paths
    doc.license_scan_urls = license_paths
    # Keep legacy first-file fields for older UI clients.
    doc.passport_scan_url = passport_paths[0] if passport_paths else None
    doc.license_scan_url = license_paths[0] if license_paths else None
    doc.verification_status = DocumentStatus.PENDING
    doc.rejection_reason = None
    doc.uploaded_at = datetime.utcnow()

    await db.commit()
    await db.refresh(doc)
    return {
        "message": "Documents uploaded",
        "client_id": doc.client_id,
        "verification_status": doc.verification_status,
        "passport_scan_urls": [_build_document_file_url(path) for path in doc.passport_scan_urls or []],
        "license_scan_urls": [_build_document_file_url(path) for path in doc.license_scan_urls or []],
    }


@router.get("/rental/{booking_id}")
async def get_rental_document(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role not in {UserRole.ADMIN, UserRole.EMPLOYEE}:
        booking = await db.get(Booking, booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        client = await db.execute(select(Client).where(Client.user_id == current_user.id))
        current_client = client.scalar_one_or_none()
        if not current_client or booking.client_id != current_client.id:
            raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(select(RentalDocument).where(RentalDocument.booking_id == booking_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Rental documents not found")
    contract_path = _extract_storage_relative_path(document.contract_path)
    act_path = _extract_storage_relative_path(document.act_path)
    power_of_attorney_path = _extract_storage_relative_path(document.power_of_attorney_path)

    return {
        "id": document.id,
        "booking_id": document.booking_id,
        "contract_path": _build_document_file_url(contract_path) if contract_path else None,
        "act_path": _build_document_file_url(act_path) if act_path else None,
        "power_of_attorney_path": _build_document_file_url(power_of_attorney_path)
        if power_of_attorney_path
        else None,
        "generated_at": document.generated_at,
        "generated_by": document.generated_by,
    }


@router.post("/{client_id}/verify")
async def verify_client_documents(
    client_id: int,
    payload: VerifyDocumentsPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_employee_or_admin_user),
):
    result = await db.execute(select(ClientDocument).where(ClientDocument.client_id == client_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Client documents not found")

    doc.verification_status = payload.status
    doc.verified_by = current_user.id
    doc.verified_at = datetime.utcnow()
    doc.rejection_reason = (
        payload.rejection_reason if payload.status == DocumentStatus.REJECTED else None
    )
    await db.commit()
    await db.refresh(doc)
    return {
        "message": "Documents verification status updated",
        "client_id": client_id,
        "verification_status": doc.verification_status,
    }
