from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from pydantic import BaseModel
from datetime import date as date_type, datetime

from database import get_db
from models import Student, School, DisciplineRecord
from auth import get_current_school, get_current_user

router = APIRouter(prefix="/discipline", tags=["Discipline"])

# ─── Schemas ────────────────────────────────────────────────────────────────────

class DisciplineCreate(BaseModel):
    student_id:  int
    type:        str
    severity:    str = "Minor"
    description: Optional[str] = None
    date:        Optional[str] = None

# ─── Routes ─────────────────────────────────────────────────────────────────────

@router.get("")
@router.get("/")
async def list_discipline_records(
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
):
    """List all discipline records for this school, newest first"""
    result = await db.execute(
        select(DisciplineRecord)
        .where(DisciplineRecord.school_id == current_school.id)
        .order_by(DisciplineRecord.created_at.desc())
    )
    records = result.scalars().all()

    data = []
    for r in records:
        stud = await db.execute(select(Student).where(Student.id == r.student_id))
        s = stud.scalar_one_or_none()
        data.append({
            "id":            r.id,
            "student_id":    r.student_id,
            "student_name":  f"{s.first_name} {s.last_name}" if s else "Unknown Student",
            "incident_type": r.incident_type,
            "severity":      r.severity,
            "description":   r.description,
            "status":        r.status,
            "date":          r.date.isoformat() if r.date else None,
        })

    return {"success": True, "data": data}


@router.post("")
@router.post("/")
async def create_discipline_record(
    payload: DisciplineCreate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    token_data: tuple = Depends(get_current_user),
):
    """Teacher records a new disciplinary incident"""
    user, _ = token_data

    stud_result = await db.execute(
        select(Student).where(
            Student.id == payload.student_id,
            Student.school_id == current_school.id,
        )
    )
    if not stud_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Student not found")

    try:
        incident_date = date_type.fromisoformat(payload.date) if payload.date else datetime.utcnow().date()
    except ValueError:
        incident_date = datetime.utcnow().date()

    record = DisciplineRecord(
        school_id     = current_school.id,
        student_id    = payload.student_id,
        reported_by   = user.id,
        incident_type = payload.type,
        severity      = payload.severity or "Minor",
        description   = payload.description,
        status        = "Open",
        date          = incident_date,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    stud2 = await db.execute(select(Student).where(Student.id == record.student_id))
    s = stud2.scalar_one_or_none()

    return {
        "success": True,
        "data": {
            "id":            record.id,
            "student_id":    record.student_id,
            "student_name":  f"{s.first_name} {s.last_name}" if s else "Unknown",
            "incident_type": record.incident_type,
            "severity":      record.severity,
            "description":   record.description,
            "status":        record.status,
            "date":          record.date.isoformat(),
        }
    }


@router.patch("/{record_id}/status")
async def update_discipline_status(
    record_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
):
    """Update status of a discipline record: Open → Resolved / Escalated"""
    result = await db.execute(
        select(DisciplineRecord).where(
            DisciplineRecord.id == record_id,
            DisciplineRecord.school_id == current_school.id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    new_status = payload.get("status", record.status)
    if new_status not in ("Open", "Resolved", "Escalated"):
        raise HTTPException(status_code=400, detail="Invalid status")

    record.status = new_status
    await db.commit()
    return {"success": True, "message": f"Status updated to {new_status}"}