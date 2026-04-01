from datetime import datetime
from decimal import Decimal
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from weasyprint import HTML

from models.booking import Booking, BookingStatus
from models.car import Car, CarStatus
from models.document import RentalDocument
from models.user import Client
from schemas.booking import BookingCreate

ACTIVE_BOOKING_STATUSES = (
    BookingStatus.PENDING_REVIEW,
    BookingStatus.CONFIRMED,
    BookingStatus.ACTIVE,
)

SERVICE_PRICES = {
    "insurance": Decimal("1000"),
    "gps": Decimal("300"),
    "childseat": Decimal("500"),
    "additionalDriver": Decimal("500"),
}

UPLOADS_DIR = Path("uploads")
DOCS_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "documents"


class BookingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_booking(self, data: BookingCreate) -> Booking:
        if data.end_date <= data.start_date:
            raise ValueError("End date must be later than start date")

        car = await self.db.get(Car, data.car_id)
        if not car:
            raise ValueError("Car not found")
        if car.status in {CarStatus.MAINTENANCE, CarStatus.RETIRED}:
            raise ValueError("Car is unavailable")

        client_id = data.client_id
        if client_id is None:
            default_client = await self.db.execute(select(Client.id).order_by(Client.id.asc()).limit(1))
            client_id = default_client.scalar_one_or_none()
        if client_id is None:
            raise ValueError("No client profile found")

        overlap = await self.db.execute(
            select(Booking.id).where(
                and_(
                    Booking.car_id == data.car_id,
                    Booking.status.in_(ACTIVE_BOOKING_STATUSES),
                    Booking.start_date < data.end_date,
                    Booking.end_date > data.start_date,
                )
            )
        )
        if overlap.scalar_one_or_none():
            raise ValueError("Car already booked for selected period")

        days = max((data.end_date - data.start_date).days, 1)
        total_price = Decimal(days) * Decimal(car.price_per_day)
        for key, enabled in data.additional_services.items():
            if enabled and key in SERVICE_PRICES:
                total_price += Decimal(days) * SERVICE_PRICES[key]

        booking = Booking(
            client_id=client_id,
            car_id=data.car_id,
            start_date=data.start_date,
            end_date=data.end_date,
            status=BookingStatus.PENDING_REVIEW,
            total_price=total_price,
        )
        self.db.add(booking)
        await self.db.commit()
        await self.db.refresh(booking)
        return booking

    async def get_booking(self, booking_id: int) -> Booking | None:
        return await self.db.get(Booking, booking_id)

    async def get_client_by_user_id(self, user_id: int) -> Client | None:
        result = await self.db.execute(select(Client).where(Client.user_id == user_id))
        return result.scalar_one_or_none()

    async def get_all_bookings(self, status: BookingStatus | None = None) -> list[Booking]:
        query = select(Booking).order_by(Booking.created_at.desc())
        if status:
            query = query.where(Booking.status == status)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_client_bookings(self, client_id: int) -> list[Booking]:
        result = await self.db.execute(
            select(Booking)
            .where(Booking.client_id == client_id)
            .order_by(Booking.created_at.desc())
        )
        return list(result.scalars().all())

    async def cancel(self, booking_id: int) -> Booking | None:
        return await self._set_status(booking_id, BookingStatus.CANCELLED)

    async def confirm(self, booking_id: int, employee_id: int | None = None) -> Booking | None:
        booking = await self._set_status(booking_id, BookingStatus.CONFIRMED)
        if not booking:
            return None
        booking.confirmed_at = datetime.utcnow()
        booking.confirmed_by = employee_id
        await self.db.commit()
        await self.db.refresh(booking)
        return booking

    async def reject(self, booking_id: int) -> Booking | None:
        return await self._set_status(booking_id, BookingStatus.REJECTED)

    async def pickup(
        self,
        booking_id: int,
        odometer: int | None = None,
        fuel: str | None = None,
    ) -> Booking | None:
        booking = await self._set_status(booking_id, BookingStatus.ACTIVE)
        if not booking:
            return None
        booking.pickup_odometer = odometer
        booking.pickup_fuel = fuel
        booking.pickup_at = datetime.utcnow()
        car = await self.db.get(Car, booking.car_id)
        if car:
            car.status = CarStatus.RENTED
        await self.db.commit()
        await self.db.refresh(booking)
        return booking

    async def return_car(
        self,
        booking_id: int,
        odometer: int | None = None,
        fuel: str | None = None,
        damages: str | None = None,
    ) -> Booking | None:
        booking = await self._set_status(booking_id, BookingStatus.RETURNED)
        if not booking:
            return None
        booking.return_odometer = odometer
        booking.return_fuel = fuel
        booking.return_damages = damages
        booking.returned_at = datetime.utcnow()
        car = await self.db.get(Car, booking.car_id)
        if car:
            car.status = CarStatus.FREE
        await self.db.commit()
        await self.db.refresh(booking)
        return booking

    async def generate_documents(
        self,
        booking_id: int,
        generated_by: int | None = None,
    ) -> RentalDocument | None:
        result = await self.db.execute(
            select(Booking)
            .where(Booking.id == booking_id)
            .options(
                selectinload(Booking.car),
                selectinload(Booking.client).selectinload(Client.user),
            )
        )
        booking = result.scalar_one_or_none()
        if not booking:
            return None

        existing = await self.db.execute(
            select(RentalDocument).where(RentalDocument.booking_id == booking_id)
        )
        rental_doc = existing.scalar_one_or_none()
        if rental_doc is None:
            rental_doc = RentalDocument(booking_id=booking_id)
            self.db.add(rental_doc)

        contract_rel = Path("contracts") / f"contract_{booking_id}.pdf"
        act_rel = Path("acts") / f"act_{booking_id}.pdf"
        poa_rel = Path("power_of_attorney") / f"poa_{booking_id}.pdf"
        contract_abs = UPLOADS_DIR / contract_rel
        act_abs = UPLOADS_DIR / act_rel
        poa_abs = UPLOADS_DIR / poa_rel

        contract_abs.parent.mkdir(parents=True, exist_ok=True)
        act_abs.parent.mkdir(parents=True, exist_ok=True)
        poa_abs.parent.mkdir(parents=True, exist_ok=True)

        template_env = Environment(
            loader=FileSystemLoader(str(DOCS_TEMPLATES_DIR)),
            autoescape=select_autoescape(["html", "xml"]),
        )
        context = self._build_documents_context(booking)

        self._render_pdf_from_template(
            template_env=template_env,
            template_name="contract.html",
            context=context,
            output_path=contract_abs,
        )
        self._render_pdf_from_template(
            template_env=template_env,
            template_name="act.html",
            context=context,
            output_path=act_abs,
        )
        self._render_pdf_from_template(
            template_env=template_env,
            template_name="power_of_attorney.html",
            context=context,
            output_path=poa_abs,
        )

        rental_doc.contract_path = f"/uploads/{contract_rel.as_posix()}"
        rental_doc.act_path = f"/uploads/{act_rel.as_posix()}"
        rental_doc.power_of_attorney_path = f"/uploads/{poa_rel.as_posix()}"
        rental_doc.generated_by = generated_by
        await self.db.commit()
        await self.db.refresh(rental_doc)
        return rental_doc

    def _build_documents_context(self, booking: Booking) -> dict:
        start_date = booking.start_date.strftime("%d.%m.%Y")
        end_date = booking.end_date.strftime("%d.%m.%Y")
        generated_date = datetime.utcnow().strftime("%d.%m.%Y")
        client_user = booking.client.user if booking.client and booking.client.user else None
        client_full_name = (
            f"{client_user.first_name} {client_user.last_name}" if client_user else f"Клиент #{booking.client_id}"
        )
        car_label = f"{booking.car.brand} {booking.car.model}" if booking.car else f"Авто #{booking.car_id}"
        car_plate = booking.car.license_plate if booking.car else "-"
        return {
            "booking_id": booking.id,
            "client_full_name": client_full_name,
            "client_email": client_user.email if client_user else "-",
            "client_phone": client_user.phone if client_user and client_user.phone else "-",
            "car_label": car_label,
            "car_plate": car_plate,
            "start_date": start_date,
            "end_date": end_date,
            "total_price": f"{Decimal(booking.total_price):,.2f}".replace(",", " "),
            "generated_date": generated_date,
        }

    def _render_pdf_from_template(
        self,
        template_env: Environment,
        template_name: str,
        context: dict,
        output_path: Path,
    ) -> None:
        template = template_env.get_template(template_name)
        html = template.render(**context)
        HTML(string=html, base_url=str(DOCS_TEMPLATES_DIR)).write_pdf(str(output_path))

    async def _set_status(self, booking_id: int, status: BookingStatus) -> Booking | None:
        booking = await self.get_booking(booking_id)
        if not booking:
            return None
        booking.status = status
        await self.db.commit()
        await self.db.refresh(booking)
        return booking
