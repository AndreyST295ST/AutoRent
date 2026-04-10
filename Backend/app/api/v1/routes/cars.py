from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_employee_or_admin_user
from app.config import settings
from app.database import get_db
from app.services.car_service import CarService
from models.user import User
from schemas.car import CarCreate, CarResponse, CarStatusUpdate, CarUpdate

router = APIRouter()

CAR_UPLOAD_DIR = Path("uploads/cars")
CAR_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
CHUNK_SIZE_BYTES = 1024 * 1024
MAX_CAR_FILE_SIZE_BYTES = settings.MAX_CAR_PHOTO_FILE_SIZE_MB * 1024 * 1024
ALLOWED_CAR_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_CAR_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


async def _save_car_photo(file: UploadFile) -> str:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_CAR_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image format '{suffix}'. Allowed: {', '.join(sorted(ALLOWED_CAR_EXTENSIONS))}",
        )
    if file.content_type and file.content_type.lower() not in ALLOWED_CAR_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"File '{file.filename}' is not an image")

    filename = f"{uuid4().hex}{suffix}"
    destination = CAR_UPLOAD_DIR / filename
    written = 0
    try:
        with destination.open("wb") as stream:
            while chunk := await file.read(CHUNK_SIZE_BYTES):
                written += len(chunk)
                if written > MAX_CAR_FILE_SIZE_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Image '{file.filename}' exceeds {settings.MAX_CAR_PHOTO_FILE_SIZE_MB} MB",
                    )
                stream.write(chunk)
    except Exception:
        if destination.exists():
            destination.unlink()
        raise

    return f"/uploads/cars/{filename}"


@router.get("/", response_model=list[CarResponse])
async def get_cars(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    min_price: float | None = Query(default=None, ge=0),
    max_price: float | None = Query(default=None, ge=0),
    transmission: str | None = Query(default=None),
    fuel_type: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if (start_date and not end_date) or (end_date and not start_date):
        raise HTTPException(
            status_code=400,
            detail="Both start_date and end_date are required for availability filter",
        )
    if start_date and end_date and end_date <= start_date:
        raise HTTPException(status_code=400, detail="end_date must be later than start_date")
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(status_code=400, detail="min_price cannot be greater than max_price")

    service = CarService(db)
    return await service.get_all_cars(
        start_date=start_date,
        end_date=end_date,
        min_price=min_price,
        max_price=max_price,
        transmission=transmission,
        fuel_type=fuel_type,
    )


@router.get("/available", response_model=list[CarResponse])
async def get_available_cars(
    start_date: datetime,
    end_date: datetime,
    db: AsyncSession = Depends(get_db),
):
    service = CarService(db)
    return await service.get_available_cars(start_date, end_date)


@router.get("/{car_id}", response_model=CarResponse)
async def get_car(car_id: int, db: AsyncSession = Depends(get_db)):
    service = CarService(db)
    car = await service.get_car(car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    return car


@router.post("/", response_model=CarResponse, status_code=status.HTTP_201_CREATED)
async def create_car(
    data: CarCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_employee_or_admin_user),
):
    service = CarService(db)
    try:
        return await service.create_car(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{car_id}", response_model=CarResponse)
async def update_car(
    car_id: int,
    data: CarUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_employee_or_admin_user),
):
    service = CarService(db)
    car = await service.update_car(car_id, data)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    return car


@router.post("/{car_id}/photos", response_model=CarResponse)
async def upload_car_photos(
    car_id: int,
    photos: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_employee_or_admin_user),
):
    if not photos:
        raise HTTPException(status_code=400, detail="No files uploaded")
    if len(photos) > settings.MAX_CAR_PHOTOS_PER_UPLOAD:
        raise HTTPException(
            status_code=400,
            detail=f"Too many files. Max {settings.MAX_CAR_PHOTOS_PER_UPLOAD} per request",
        )

    service = CarService(db)
    car = await service.get_car(car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    new_urls: list[str] = []
    for photo in photos:
        try:
            new_urls.append(await _save_car_photo(photo))
        finally:
            await photo.close()

    existing = list(car.photo_urls or [])
    car.photo_urls = [*existing, *new_urls]
    await db.commit()
    await db.refresh(car)
    return car


@router.patch("/{car_id}/status", response_model=CarResponse)
async def update_car_status(
    car_id: int,
    data: CarStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_employee_or_admin_user),
):
    service = CarService(db)
    car = await service.update_status(car_id, data.status)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    return car


@router.delete("/{car_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_car(
    car_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_employee_or_admin_user),
):
    service = CarService(db)
    ok = await service.delete_car(car_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Car not found")
    return None
