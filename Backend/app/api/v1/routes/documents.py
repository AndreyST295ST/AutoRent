from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_active_user,
    get_current_client,
    get_employee_or_admin_user,
)
from app.database import get_db
from models.booking import Booking, BookingStatus
from models.car import Car
from models.document import ClientDocument, DocumentStatus, RentalDocument
from models.user import Client, User, UserRole

router = APIRouter()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_DOC_FILES_PER_TYPE = 2

ACTIVE_BOOKING_STATUSES = {
    BookingStatus.PENDING_REVIEW,
    BookingStatus.CONFIRMED,
    BookingStatus.ACTIVE,
}


class VerifyDocumentsPayload(BaseModel):
    status: DocumentStatus
    rejection_reason: str | None = None


async def _save_upload(file: UploadFile, suffix: str) -> str:
    filename = f"{uuid4()}_{suffix}_{file.filename}"
    dest = UPLOAD_DIR / filename
    content = await file.read()
    dest.write_bytes(content)
    return f"/uploads/{filename}"


def _safe_float(value) -> float:
    return float(value) if value is not None else 0.0


def _extract_urls(doc: ClientDocument | None, key: str) -> list[str]:
    if not doc:
        return []

    list_attr = f"{key}_scan_urls"
    single_attr = f"{key}_scan_url"

    raw_list = getattr(doc, list_attr, None)
    if isinstance(raw_list, list):
        cleaned = [str(url).strip() for url in raw_list if str(url).strip()]
        if cleaned:
            return cleaned

    legacy = getattr(doc, single_attr, None)
    if legacy:
        return [legacy]

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

    passport_urls: list[str] = []
    license_urls: list[str] = []

    try:
        for index, file in enumerate(passport_files, start=1):
            passport_urls.append(await _save_upload(file, f"passport_{index}"))
        for index, file in enumerate(license_files, start=1):
            license_urls.append(await _save_upload(file, f"license_{index}"))
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

    doc.passport_scan_urls = passport_urls
    doc.license_scan_urls = license_urls
    # Keep legacy first-file fields for older UI clients.
    doc.passport_scan_url = passport_urls[0] if passport_urls else None
    doc.license_scan_url = license_urls[0] if license_urls else None
    doc.verification_status = DocumentStatus.PENDING
    doc.rejection_reason = None
    doc.uploaded_at = datetime.utcnow()

    await db.commit()
    await db.refresh(doc)
    return {
        "message": "Documents uploaded",
        "client_id": doc.client_id,
        "verification_status": doc.verification_status,
        "passport_scan_urls": doc.passport_scan_urls,
        "license_scan_urls": doc.license_scan_urls,
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
    return document


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
