from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from pydantic import BaseModel
from datetime import time, date
from sqlalchemy import select

from database import get_db
from models import User, TransportRoute, TransportEnrollment, BoardingHouse, BoardingEnrollment, Student
from auth import get_current_user

router = APIRouter(prefix="/api", tags=["Transport & Boarding"])

# --- PYDANTIC SCHEMAS ---
class RouteCreate(BaseModel):
    route_name: str
    route_code: str
    start_location: Optional[str] = None
    end_location: Optional[str] = None
    pickup_time: Optional[time] = None
    dropoff_time: Optional[time] = None
    vehicle_type: Optional[str] = None
    capacity: Optional[int] = None
    fare_amount: Optional[float] = None

class BoardingHouseCreate(BaseModel):
    house_name: str
    house_code: str
    capacity: Optional[int] = None
    gender_type: Optional[str] = None
    fee_amount: Optional[float] = None

# ==========================================
# TRANSPORT ROUTES
# ==========================================

@router.get("/routes")
async def get_routes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    routes = (await db.execute(select(TransportRoute).filter(TransportRoute.school_id == current_user.school_id))).scalars().all()
    return {"data": routes}

@router.post("/routes")
async def create_route(payload: RouteCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        new_route = TransportRoute(**payload.dict(), school_id=current_user.school_id)
        db.add(new_route)
        await db.commit()
        await db.refresh(new_route)
        return {"data": new_route, "message": "Route created successfully"}
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Route code already exists")

@router.get("/enrollments")
async def get_transport_enrollments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    enrollments = (await db.execute(select(TransportEnrollment).filter(TransportEnrollment.school_id == current_user.school_id))).scalars().all()
    # Eager load relationships or manually map for the frontend
    data = []
    for e in enrollments:
        student_name = f"{e.student.first_name} {e.student.last_name}" if e.student else None
        route_name = e.route.route_name if e.route else None
        data.append({
            "id": e.id,
            "route_name": route_name,
            "student_name": student_name,
            "amount_due": e.amount_due,
            "status": e.status
        })
    return {"data": data}

# ==========================================
# BOARDING ROUTES
# ==========================================

@router.get("/boarding-houses")
async def get_boarding_houses(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    houses = (await db.execute(select(BoardingHouse).filter(BoardingHouse.school_id == current_user.school_id))).scalars().all()
    return {"data": houses}

@router.post("/boarding-houses")
async def create_boarding_house(payload: BoardingHouseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        new_house = BoardingHouse(**payload.dict(), school_id=current_user.school_id)
        db.add(new_house)
        await db.commit()
        await db.refresh(new_house)
        return {"data": new_house, "message": "Boarding house created successfully"}
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="House code already exists")