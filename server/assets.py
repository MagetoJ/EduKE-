from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from database import get_db
from models import Asset, AssetMovement, School, User
from auth import get_current_school, get_current_user

router = APIRouter(prefix="/assets", tags=["Assets & Inventory"])

# --- Schemas ---
class AssetCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    quantity: int = 0
    asset_type: str # e.g., "Textbook", "Lab Equipment", "Furniture"

class AssetResponse(BaseModel):
    id: int
    name: str
    sku: Optional[str]
    quantity: int
    asset_type: str
    class Config:
        from_attributes = True

class MovementCreate(BaseModel):
    asset_id: int
    quantity: int
    movement_type: str # "IN" (Stock added), "OUT" (Issued to someone)
    notes: Optional[str] = None

class MovementResponse(BaseModel):
    id: int
    asset_id: int
    quantity: int
    movement_type: str
    notes: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True

# --- Routes ---

@router.get("/", response_model=List[AssetResponse])
async def get_assets(
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """List all assets belonging to the school"""
    result = await db.execute(
        select(Asset).where(Asset.school_id == current_school.id)
    )
    return result.scalars().all()

@router.post("/", response_model=AssetResponse)
async def create_asset(
    data: AssetCreate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """Register a new asset category/item"""
    new_asset = Asset(
        **data.dict(),
        school_id=current_school.id
    )
    db.add(new_asset)
    await db.commit()
    await db.refresh(new_asset)
    return new_asset

@router.post("/movements", response_model=MovementResponse)
async def record_movement(
    data: MovementCreate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    current_user: tuple = Depends(get_current_user)
):
    """Record stock movement (In/Out) - SmartBiz Stock Pattern"""
    user, _ = current_user

    # 1. Verify asset belongs to this school
    asset_result = await db.execute(
        select(Asset).where(Asset.id == data.asset_id, Asset.school_id == current_school.id)
    )
    asset = asset_result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # 2. Update quantity
    if data.movement_type.upper() == "IN":
        asset.quantity += data.quantity
    elif data.movement_type.upper() == "OUT":
        if asset.quantity < data.quantity:
            raise HTTPException(status_code=400, detail="Insufficient stock for issuance")
        asset.quantity -= data.quantity
    else:
        raise HTTPException(status_code=400, detail="Invalid movement type. Use 'IN' or 'OUT'")

    # 3. Create movement record
    new_movement = AssetMovement(
        **data.dict(),
        user_id=user.id
    )
    db.add(new_movement)
    
    await db.commit()
    await db.refresh(new_movement)
    return new_movement

@router.get("/{asset_id}/history", response_model=List[MovementResponse])
async def get_asset_history(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """View movement history for a specific asset"""
    # Verify ownership
    asset_result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.school_id == current_school.id)
    )
    if not asset_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Asset not found")

    result = await db.execute(
        select(AssetMovement).where(AssetMovement.asset_id == asset_id).order_by(AssetMovement.created_at.desc())
    )
    return result.scalars().all()
