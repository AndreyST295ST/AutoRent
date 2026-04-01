from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from models.booking import BookingStatus


class BookingCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    client_id: Optional[int] = None
    car_id: int = Field(..., alias="carId")
    start_date: datetime = Field(..., alias="startDate")
    end_date: datetime = Field(..., alias="endDate")
    additional_services: dict[str, bool] = Field(default_factory=dict, alias="additionalServices")


class BookingStatusUpdate(BaseModel):
    odometer: Optional[int] = None
    fuel: Optional[str] = None
    damages: Optional[str] = None


class BookingResponse(BaseModel):
    id: int
    client_id: int
    car_id: int
    start_date: datetime
    end_date: datetime
    status: BookingStatus
    total_price: float
    created_at: datetime

    class Config:
        from_attributes = True
