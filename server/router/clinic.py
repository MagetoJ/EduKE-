# server/router/clinic.py

from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_school, require_roles
from models import ClinicInventory, ClinicLog, School, Student, StudentHealthProfile, User

router = APIRouter(prefix="/api/clinic", tags=["clinic"])

# --- Pydantic Schemas ---


class DispenseRequest(BaseModel):
    student_id: int
    medication_id: UUID
    amount: int


# --- API Endpoints ---


@router.get("/stats")
async def get_clinic_stats(
    current_user: User = Depends(require_roles("nurse")),
    current_school: School = Depends(get_current_school),
    db: AsyncSession = Depends(get_db),
):
    """Fetches the daily statistics for the Nurse Dashboard, scoped to the current school."""
    today = date.today()

    low_stock_result = await db.execute(
        select(func.count()).select_from(ClinicInventory).where(
            ClinicInventory.school_id == current_school.id,
            ClinicInventory.current_stock <= ClinicInventory.low_stock_threshold,
        )
    )
    low_stock_count = low_stock_result.scalar_one()

    total_visits_result = await db.execute(
        select(func.count()).select_from(ClinicLog).where(
            ClinicLog.school_id == current_school.id,
            func.date(ClinicLog.timestamp) == today,
        )
    )
    total_visits_today = total_visits_result.scalar_one()

    pending_meds_result = await db.execute(
        select(func.count()).select_from(ClinicLog).where(
            ClinicLog.school_id == current_school.id,
            func.date(ClinicLog.timestamp) == today,
            ClinicLog.visit_type == "Pending Medication",
        )
    )
    pending_meds_count = pending_meds_result.scalar_one()

    return {
        "pending_meds": pending_meds_count,
        "low_stock": low_stock_count,
        "total_visits": total_visits_today,
    }


@router.get("/students/search")
async def search_students(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(require_roles("nurse")),
    current_school: School = Depends(get_current_school),
    db: AsyncSession = Depends(get_db),
):
    """Searches for students within the current school and attaches basic health profile flags."""
    search_pattern = f"%{q}%"

    stmt = (
        select(Student, StudentHealthProfile)
        .outerjoin(StudentHealthProfile, Student.id == StudentHealthProfile.student_id)
        .where(
            Student.school_id == current_school.id,
            (Student.first_name.ilike(search_pattern)) | (Student.last_name.ilike(search_pattern)),
        )
        .limit(10)
    )
    result = await db.execute(stmt)

    response = []
    for student, profile in result.all():
        response.append({
            "student_id": str(student.id),
            "name": f"{student.first_name} {student.last_name}",
            "grade": student.grade,
            "has_profile": profile is not None,
            "critical_allergies": profile.critical_allergies if profile else [],
        })

    return response


@router.post("/dispense")
async def dispense_medication(
    payload: DispenseRequest,
    current_user: User = Depends(require_roles("nurse")),
    current_school: School = Depends(get_current_school),
    db: AsyncSession = Depends(get_db),
):
    """Deducts stock from clinic inventory and creates an immutable clinic log, scoped to the current school."""

    # 1. Confirm the student belongs to this school (tenant check)
    student_result = await db.execute(
        select(Student).where(Student.id == payload.student_id, Student.school_id == current_school.id)
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found in this school")

    # 2. Fetch inventory item, also scoped to this school
    inventory_result = await db.execute(
        select(ClinicInventory).where(
            ClinicInventory.medication_id == payload.medication_id,
            ClinicInventory.school_id == current_school.id,
        )
    )
    inventory_item = inventory_result.scalar_one_or_none()

    if not inventory_item:
        raise HTTPException(status_code=404, detail="Medication not found")

    if inventory_item.current_stock < payload.amount:
        raise HTTPException(status_code=400, detail="Insufficient stock to dispense")

    try:
        # 3. Deduct from inventory
        inventory_item.current_stock -= payload.amount

        # 4. Create audit log
        new_log = ClinicLog(
            school_id=current_school.id,
            student_id=payload.student_id,
            nurse_id=current_user.id,
            visit_type="Routine Medication",
            action_taken=f"Dispensed {payload.amount} unit(s) of {inventory_item.medication_name}",
            medication_dispensed_id=payload.medication_id,
        )
        db.add(new_log)

        # 5. Low stock notification hook (wire into your existing notification service here)
        if inventory_item.current_stock <= inventory_item.low_stock_threshold:
            pass

        await db.commit()
        return {"success": True, "message": "Medication logged successfully"}

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
