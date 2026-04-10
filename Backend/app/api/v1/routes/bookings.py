import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_active_user,
    get_current_client,
    get_employee_or_admin_user,
)
from app.config import settings
from app.database import get_db
from app.services.booking_service import BookingService
from app.services.email_service import EmailService
from models.booking import BookingStatus
from models.car import Car
from models.user import Client, User, UserRole
from schemas.booking import BookingCreate, BookingResponse, BookingStatusUpdate

router = APIRouter()
LOGGER = logging.getLogger(__name__)


BOOKING_STATUS_LABELS: dict[BookingStatus, str] = {
    BookingStatus.PENDING_REVIEW: "На рассмотрении",
    BookingStatus.CONFIRMED: "Подтверждена",
    BookingStatus.ACTIVE: "Активна",
    BookingStatus.RETURNED: "Завершена",
    BookingStatus.CANCELLED: "Отменена",
    BookingStatus.REJECTED: "Отклонена",
}


def _is_employee_or_admin(user: User) -> bool:
    return user.role in {UserRole.EMPLOYEE, UserRole.ADMIN}


async def _build_booking_email_context(db: AsyncSession, booking_id: int) -> dict | None:
    service = BookingService(db)
    booking = await service.get_booking(booking_id)
    if not booking:
        return None

    client_result = await db.execute(select(Client).where(Client.id == booking.client_id))
    client = client_result.scalar_one_or_none()
    if not client:
        return None

    user_result = await db.execute(select(User).where(User.id == client.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        return None

    car = await db.get(Car, booking.car_id)
    car_label = f"{car.brand} {car.model}" if car else f"Авто #{booking.car_id}"
    start_date = booking.start_date.strftime("%d.%m.%Y")
    end_date = booking.end_date.strftime("%d.%m.%Y")
    total = Decimal(str(booking.total_price)) if booking.total_price is not None else Decimal("0")
    total_price = f"{total:,.2f}".replace(",", " ")
    status_label = BOOKING_STATUS_LABELS.get(booking.status, str(booking.status))
    details_url = f"{settings.FRONTEND_URL.rstrip('/')}/pages/MyBookings.html"

    return {
        "recipient_email": user.email,
        "first_name": user.first_name,
        "booking_id": booking.id,
        "status_label": status_label,
        "car_label": car_label,
        "start_date": start_date,
        "end_date": end_date,
        "total_price": total_price,
        "details_url": details_url,
    }


async def _send_booking_notification_safe(db: AsyncSession, booking_id: int) -> None:
    try:
        context = await _build_booking_email_context(db, booking_id)
        if not context:
            return
        await EmailService().send_booking_notification_email(**context)
    except Exception as exc:
        LOGGER.warning("Booking email notification failed for booking_id=%s: %s", booking_id, exc)


@router.get("/", response_model=list[BookingResponse])
async def get_bookings(
    status_filter: BookingStatus | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_employee_or_admin_user),
):
    service = BookingService(db)
    return await service.get_all_bookings(status=status_filter)


@router.get("/my", response_model=list[BookingResponse])
async def get_my_bookings(
    db: AsyncSession = Depends(get_db),
    current_client: Client = Depends(get_current_client),
):
    service = BookingService(db)
    return await service.get_client_bookings(current_client.id)


@router.post("/", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_data: BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_client: Client = Depends(get_current_client),
):
    service = BookingService(db)
    try:
        payload = booking_data.model_copy(update={"client_id": current_client.id})
        booking = await service.create_booking(payload)
        await _send_booking_notification_safe(db, booking.id)
        return booking
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = BookingService(db)
    booking = await service.get_booking(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if not _is_employee_or_admin(current_user):
        current_client = await service.get_client_by_user_id(current_user.id)
        if not current_client or booking.client_id != current_client.id:
            raise HTTPException(status_code=403, detail="Access denied")
    return booking


@router.post("/{booking_id}/cancel", response_model=BookingResponse)
async def cancel_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = BookingService(db)
    booking = await service.get_booking(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if not _is_employee_or_admin(current_user):
        current_client = await service.get_client_by_user_id(current_user.id)
        if not current_client or booking.client_id != current_client.id:
            raise HTTPException(status_code=403, detail="Access denied")

    booking = await service.cancel(booking_id)
    await _send_booking_notification_safe(db, booking_id)
    return booking


@router.post("/{booking_id}/confirm", response_model=BookingResponse)
async def confirm_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_employee_or_admin_user),
):
    service = BookingService(db)
    booking = await service.confirm(booking_id, employee_id=current_user.id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    await _send_booking_notification_safe(db, booking_id)
    return booking


@router.post("/{booking_id}/reject", response_model=BookingResponse)
async def reject_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_employee_or_admin_user),
):
    service = BookingService(db)
    booking = await service.reject(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    await _send_booking_notification_safe(db, booking_id)
    return booking


@router.post("/{booking_id}/pickup", response_model=BookingResponse)
async def pickup_booking(
    booking_id: int,
    payload: BookingStatusUpdate | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_employee_or_admin_user),
):
    odometer = payload.odometer if payload else None
    fuel = payload.fuel if payload else None
    service = BookingService(db)
    booking = await service.pickup(booking_id, odometer=odometer, fuel=fuel)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    await _send_booking_notification_safe(db, booking_id)
    return booking


@router.post("/{booking_id}/return", response_model=BookingResponse)
async def return_booking(
    booking_id: int,
    payload: BookingStatusUpdate | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_employee_or_admin_user),
):
    odometer = payload.odometer if payload else None
    fuel = payload.fuel if payload else None
    damages = payload.damages if payload else None
    service = BookingService(db)
    booking = await service.return_car(
        booking_id,
        odometer=odometer,
        fuel=fuel,
        damages=damages,
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    await _send_booking_notification_safe(db, booking_id)
    return booking


@router.post("/{booking_id}/generate-documents")
async def generate_documents(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_employee_or_admin_user),
):
    service = BookingService(db)
    docs = await service.generate_documents(booking_id, generated_by=current_user.id)
    if not docs:
        raise HTTPException(status_code=404, detail="Booking not found")
    return docs
