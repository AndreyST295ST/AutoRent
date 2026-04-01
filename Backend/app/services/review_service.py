from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.booking import Booking, BookingStatus
from models.car import Car
from models.review import Review, ReviewStatus
from models.user import Client
from schemas.review import ReviewCreate, ReviewUpdate


class ReviewService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_review(self, review_id: int) -> Review | None:
        return await self.db.get(Review, review_id)

    async def get_reviews(self, car_id: int | None = None) -> list[Review]:
        query = (
            select(Review)
            .where(Review.status == ReviewStatus.PUBLISHED)
            .order_by(Review.created_at.desc())
        )
        if car_id is not None:
            query = query.where(Review.car_id == car_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_client_reviews(self, client_id: int) -> list[Review]:
        result = await self.db.execute(
            select(Review).where(Review.client_id == client_id).order_by(Review.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_client_by_user_id(self, user_id: int) -> Client | None:
        result = await self.db.execute(select(Client).where(Client.user_id == user_id))
        return result.scalar_one_or_none()

    async def create_review(self, client_id: int, payload: ReviewCreate) -> Review:
        car = await self.db.get(Car, payload.car_id)
        if not car:
            raise ValueError("Car not found")

        completed_booking = await self.db.execute(
            select(Booking.id).where(
                Booking.client_id == client_id,
                Booking.car_id == payload.car_id,
                Booking.status == BookingStatus.RETURNED,
            )
        )
        if not completed_booking.scalar_one_or_none():
            raise ValueError("Review can be left only after completed rental")

        existing_review = await self.db.execute(
            select(Review.id).where(
                Review.client_id == client_id,
                Review.car_id == payload.car_id,
            )
        )
        if existing_review.scalar_one_or_none():
            raise ValueError("Review for this car already exists")

        review = Review(
            client_id=client_id,
            car_id=payload.car_id,
            rating=payload.rating,
            comment=payload.comment,
        )
        self.db.add(review)
        await self.db.commit()
        await self.db.refresh(review)
        return review

    async def update_review(
        self,
        review_id: int,
        payload: ReviewUpdate,
        client_id: int | None = None,
        is_admin: bool = False,
    ) -> Review | None:
        review = await self.get_review(review_id)
        if not review:
            return None
        if not is_admin and review.client_id != client_id:
            raise PermissionError("Access denied")

        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(review, key, value)

        await self.db.commit()
        await self.db.refresh(review)
        return review

    async def delete_review(
        self,
        review_id: int,
        client_id: int | None = None,
        is_admin: bool = False,
    ) -> bool:
        review = await self.get_review(review_id)
        if not review:
            return False
        if not is_admin and review.client_id != client_id:
            raise PermissionError("Access denied")

        await self.db.delete(review)
        await self.db.commit()
        return True
