from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import CheckConstraint, Column, DateTime, Enum, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class ReviewStatus(str, PyEnum):
    PUBLISHED = "published"
    HIDDEN = "hidden"


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("client_id", "car_id", name="uq_reviews_client_car"),
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating"),
    )

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    car_id = Column(Integer, ForeignKey("cars.id"), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text)
    status = Column(Enum(ReviewStatus), default=ReviewStatus.PUBLISHED, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship("Client", back_populates="reviews")
    car = relationship("Car", back_populates="reviews")

