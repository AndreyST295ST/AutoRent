from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_employee_or_admin_user
from app.database import get_db
from app.services.car_service import CarService
from models.user import User
from schemas.car import CarCreate, CarResponse, CarStatusUpdate, CarUpdate

router = APIRouter()

CAR_UPLOAD_DIR = Path("uploads/cars")
CAR_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


async def _save_car_photo(file: UploadFile) -> str:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail=f"File '{file.filename}' is not an image")

    suffix = Path(file.filename or "").suffix.lower() or ".jpg"
    filename = f"{uuid4().hex}{suffix}"
    destination = CAR_UPLOAD_DIR / filename
    destination.write_bytes(await file.read())
    return f"/uploads/cars/{filename}"


@router.get("/", response_model=list[CarResponse])
async def get_cars(db: AsyncSession = Depends(get_db)):
    service = CarService(db)
    return await service.get_all_cars()


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
