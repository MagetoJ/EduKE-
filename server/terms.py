from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from datetime import date
from typing import List
from database import get_db
from models import AcademicTerm
from auth import get_current_school
from services.term_service import check_and_update_active_term

router = APIRouter(prefix="/api/terms", tags=["Academic Terms"])

class TermCreateSchema(BaseModel):
    name: str            # e.g., "Term 1"
    academic_year: int   # e.g., 2026
    start_date: date
    end_date: date

@router.get("/active-term")
async def get_current_active_term(
    db: AsyncSession = Depends(get_db),
    current_school = Depends(get_current_school)
):
    """
    Evaluates current date and automatically updates active term 
    before returning it to the client.
    """
    school_id = getattr(current_school, "id", None)
    active_term = await check_and_update_active_term(db, school_id)
    return {
        "success": True,
        "active_term": active_term
    }

@router.get("", response_model=List[dict])
async def list_terms(db: AsyncSession = Depends(get_db)):
    await check_and_update_active_term(db) # Auto-update before listing
    result = await db.execute(select(AcademicTerm).order_by(AcademicTerm.start_date))
    terms = result.scalars().all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "academic_year": t.academic_year,
            "start_date": t.start_date,
            "end_date": t.end_date,
            "is_active": t.is_active
        }
        for t in terms
    ]

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_term(payload: TermCreateSchema, db: AsyncSession = Depends(get_db)):
    new_term = AcademicTerm(
        name=payload.name,
        academic_year=payload.academic_year,
        start_date=payload.start_date,
        end_date=payload.end_date,
        is_active=False
    )
    db.add(new_term)
    await db.commit()
    
    # Auto-activate immediately if start_date <= today <= end_date
    await check_and_update_active_term(db)
    return {"success": True, "message": f"Term {payload.name} created successfully."}