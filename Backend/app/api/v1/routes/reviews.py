from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_current_client
from app.database import get_db
from app.services.review_service import ReviewService
from models.review import ReviewStatus
from models.user import Client, User, UserRole
from schemas.review import ReviewCreate, ReviewResponse, ReviewUpdate

router = APIRouter()


@router.get("/", response_model=list[ReviewResponse])
async def get_reviews(
    car_id: int | None = Query(default=None, alias="carId"),
    db: AsyncSession = Depends(get_db),
):
    service = ReviewService(db)
    return await service.get_reviews(car_id=car_id)


@router.get("/my", response_model=list[ReviewResponse])
async def get_my_reviews(
    db: AsyncSession = Depends(get_db),
    current_client: Client = Depends(get_current_client),
):
    service = ReviewService(db)
    return await service.get_client_reviews(current_client.id)


@router.get("/{review_id}", response_model=ReviewResponse)
async def get_review(review_id: int, db: AsyncSession = Depends(get_db)):
    service = ReviewService(db)
    review = await service.get_review(review_id)
    if not review or review.status != ReviewStatus.PUBLISHED:
        raise HTTPException(status_code=404, detail="Review not found")
    return review


@router.post("/", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    payload: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    current_client: Client = Depends(get_current_client),
):
    service = ReviewService(db)
    try:
        return await service.create_review(client_id=current_client.id, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{review_id}", response_model=ReviewResponse)
async def update_review(
    review_id: int,
    payload: ReviewUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = ReviewService(db)

    is_admin = current_user.role == UserRole.ADMIN
    if current_user.role not in {UserRole.ADMIN, UserRole.CLIENT}:
        raise HTTPException(status_code=403, detail="Access denied")

    client_id: int | None = None
    if not is_admin:
        if payload.status is not None:
            raise HTTPException(status_code=403, detail="Only admin can change review status")
        client = await service.get_client_by_user_id(current_user.id)
        if not client:
            raise HTTPException(status_code=404, detail="Client profile not found")
        client_id = client.id

    try:
        review = await service.update_review(
            review_id=review_id,
            payload=payload,
            client_id=client_id,
            is_admin=is_admin,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return review


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(
    review_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = ReviewService(db)

    is_admin = current_user.role == UserRole.ADMIN
    if current_user.role not in {UserRole.ADMIN, UserRole.CLIENT}:
        raise HTTPException(status_code=403, detail="Access denied")

    client_id: int | None = None
    if not is_admin:
        client = await service.get_client_by_user_id(current_user.id)
        if not client:
            raise HTTPException(status_code=404, detail="Client profile not found")
        client_id = client.id

    try:
        deleted = await service.delete_review(
            review_id=review_id,
            client_id=client_id,
            is_admin=is_admin,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    if not deleted:
        raise HTTPException(status_code=404, detail="Review not found")
    return None

