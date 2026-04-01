from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, DECIMAL, Enum, Text
from sqlalchemy.orm import relationship
from enum import Enum as PyEnum
from datetime import datetime
from app.database import Base

class BookingStatus(str, PyEnum):
    PENDING_REVIEW = "pending_review"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    ACTIVE = "active"
    RETURNED = "returned"
    CANCELLED = "cancelled"

class Booking(Base):
    __tablename__ = "bookings"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    car_id = Column(Integer, ForeignKey("cars.id"), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    status = Column(Enum(BookingStatus), default=BookingStatus.PENDING_REVIEW, nullable=False)
    total_price = Column(DECIMAL(12, 2), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    confirmed_at = Column(DateTime)
    confirmed_by = Column(Integer, ForeignKey("users.id"))
    pickup_odometer = Column(Integer)
    pickup_fuel = Column(String(20))
    pickup_at = Column(DateTime)
    return_odometer = Column(Integer)
    return_fuel = Column(String(20))
    return_damages = Column(Text)
    returned_at = Column(DateTime)
    
    client = relationship("Client", back_populates="bookings")
    car = relationship("Car", back_populates="bookings")
    rental_documents = relationship("RentalDocument", back_populates="booking", uselist=False)

