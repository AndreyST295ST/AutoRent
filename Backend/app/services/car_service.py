from datetime import datetime

from sqlalchemy import Select, and_, func, not_, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.booking import Booking, BookingStatus
from models.car import Car, CarStatus
from schemas.car import CarCreate, CarUpdate

ACTIVE_BOOKING_STATUSES = (
    BookingStatus.PENDING_REVIEW,
    BookingStatus.CONFIRMED,
    BookingStatus.ACTIVE,
)


class CarService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all_cars(
        self,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        min_price: float | None = None,
        max_price: float | None = None,
        transmission: str | None = None,
        fuel_type: str | None = None,
    ) -> list[Car]:
        query: Select = select(Car)

        filters = []
        if min_price is not None:
            filters.append(Car.price_per_day >= min_price)
        if max_price is not None:
            filters.append(Car.price_per_day <= max_price)
        if transmission:
            filters.append(func.lower(Car.transmission) == transmission.strip().lower())
        if fuel_type:
            filters.append(func.lower(Car.fuel_type) == fuel_type.strip().lower())

        if start_date and end_date:
            overlapping = (
                select(Booking.car_id)
                .where(
                    and_(
                        Booking.status.in_(ACTIVE_BOOKING_STATUSES),
                        Booking.start_date < end_date,
                        Booking.end_date > start_date,
                    )
                )
                .subquery()
            )
            filters.extend(
                [
                    Car.status == CarStatus.FREE,
                    not_(Car.id.in_(select(overlapping.c.car_id))),
                ]
            )

        if filters:
            query = query.where(and_(*filters))

        query = query.order_by(Car.created_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_car(self, car_id: int) -> Car | None:
        return await self.db.get(Car, car_id)

    async def get_available_cars(self, start_date: datetime, end_date: datetime) -> list[Car]:
        overlapping = (
            select(Booking.car_id)
            .where(
                and_(
                    Booking.status.in_(ACTIVE_BOOKING_STATUSES),
                    Booking.start_date < end_date,
                    Booking.end_date > start_date,
                )
            )
            .subquery()
        )
        query: Select = (
            select(Car)
            .where(
                and_(
                    Car.status == CarStatus.FREE,
                    not_(Car.id.in_(select(overlapping.c.car_id))),
                )
            )
            .order_by(Car.created_at.desc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create_car(self, data: CarCreate) -> Car:
        existing = await self.db.execute(select(Car).where(Car.license_plate == data.license_plate))
        if existing.scalar_one_or_none():
            raise ValueError("\u0410\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u044c \u0441 \u0442\u0430\u043a\u0438\u043c \u0433\u043e\u0441\u043d\u043e\u043c\u0435\u0440\u043e\u043c \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442")

        car = Car(**data.model_dump())
        self.db.add(car)
        await self.db.commit()
        await self.db.refresh(car)
        return car

    async def update_car(self, car_id: int, data: CarUpdate) -> Car | None:
        car = await self.get_car(car_id)
        if not car:
            return None

        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(car, key, value)

        await self.db.commit()
        await self.db.refresh(car)
        return car

    async def update_status(self, car_id: int, status: CarStatus) -> Car | None:
        return await self.update_car(car_id, CarUpdate(status=status))

    async def delete_car(self, car_id: int) -> bool:
        car = await self.get_car(car_id)
        if not car:
            return False
        await self.db.delete(car)
        await self.db.commit()
        return True

