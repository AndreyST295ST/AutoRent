from datetime import date, datetime, time
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from models.booking import BookingStatus


class BookingCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    client_id: Optional[int] = None
    car_id: int = Field(..., alias="carId")
    start_date: datetime = Field(..., alias="startDate")
    end_date: datetime = Field(..., alias="endDate")
    additional_services: dict[str, bool] = Field(default_factory=dict, alias="additionalServices")

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def parse_date_or_datetime(cls, value):
        if isinstance(value, datetime):
            return value
        if isinstance(value, date):
            return datetime.combine(value, time.min)
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return value
            # Support HTML <input type="date"> payloads (YYYY-MM-DD).
            if len(raw) == 10:
                return datetime.combine(date.fromisoformat(raw), time.min)
        return value


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
