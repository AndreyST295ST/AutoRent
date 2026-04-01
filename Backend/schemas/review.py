from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from models.review import ReviewStatus


class ReviewCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    car_id: int = Field(..., alias="carId")
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = Field(default=None, max_length=3000)


class ReviewUpdate(BaseModel):
    rating: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = Field(default=None, max_length=3000)
    status: ReviewStatus | None = None


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    car_id: int
    rating: int
    comment: str | None
    status: ReviewStatus
    created_at: datetime
    updated_at: datetime
