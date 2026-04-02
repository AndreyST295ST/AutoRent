from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from models.car import CarStatus


class CarBase(BaseModel):
    brand: str = Field(..., min_length=1, max_length=50)
    model: str = Field(..., min_length=1, max_length=50)
    year: Optional[int] = None
    license_plate: str = Field(..., min_length=3, max_length=20)
    color: Optional[str] = None
    transmission: Optional[str] = None
    fuel_type: Optional[str] = None
    seats: Optional[int] = None
    price_per_day: float
    status: CarStatus = CarStatus.FREE
    description: Optional[str] = None
    photo_urls: list[str] = Field(default_factory=list)


class CarCreate(CarBase):
    pass


class CarUpdate(BaseModel):
    brand: Optional[str] = Field(default=None, min_length=1, max_length=50)
    model: Optional[str] = Field(default=None, min_length=1, max_length=50)
    year: Optional[int] = None
    license_plate: Optional[str] = Field(default=None, min_length=3, max_length=20)
    color: Optional[str] = None
    transmission: Optional[str] = None
    fuel_type: Optional[str] = None
    seats: Optional[int] = None
    price_per_day: Optional[float] = None
    status: Optional[CarStatus] = None
    description: Optional[str] = None
    photo_urls: Optional[list[str]] = None


class CarStatusUpdate(BaseModel):
    status: CarStatus


class CarResponse(CarBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
