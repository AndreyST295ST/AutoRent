from sqlalchemy import Column, Integer, String, DECIMAL, Enum, DateTime, Text
from sqlalchemy.orm import relationship
from enum import Enum as PyEnum
from datetime import datetime
from app.database import Base

class CarStatus(str, PyEnum):
    FREE = "free"
    RENTED = "rented"
    MAINTENANCE = "maintenance"
    RETIRED = "retired"

class Car(Base):
    __tablename__ = "cars"
    
    id = Column(Integer, primary_key=True, index=True)
    brand = Column(String(50), nullable=False)
    model = Column(String(50), nullable=False)
    year = Column(Integer)
    license_plate = Column(String(20), unique=True, nullable=False)
    color = Column(String(30))
    transmission = Column(String(20))  # manual/automatic
    fuel_type = Column(String(20))  # petrol/diesel/electric
    seats = Column(Integer)
    price_per_day = Column(DECIMAL(10, 2), nullable=False)
    status = Column(Enum(CarStatus), default=CarStatus.FREE, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    bookings = relationship("Booking", back_populates="car")
    reviews = relationship("Review", back_populates="car")

