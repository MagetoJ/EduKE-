from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from typing import List
from pydantic import BaseModel
from datetime import date

from database import async_session_maker
from models import User, Student
from models_roles import ClassTeacherAssignment
from models_class_teacher import DailyAttendance, ClassTeacherRemark, StudentWelfareEscalation

router = APIRouter(prefix="/api/class-teacher", tags=["Class Teacher Workloads"])

# --- Request Schemas ---
class AttendanceEntry(BaseModel):
    student_id: int
    status: str # present, absent, late
    remarks: str | None = None

class AttendanceBatchPayload(BaseModel):
    date: date
    entries: List[AttendanceEntry]

class RemarkPayload(BaseModel):
    student_id: int
    term: int
    remarks: str

class EscalationPayload(BaseModel):
    student_id: int
    reason: str
    details: str | None = None

# Helper to verify class teacher context
async def get_managed_class(teacher_id: int, db) -> ClassTeacherAssignment:
    result = await db.execute(
        select(ClassTeacherAssignment).filter(ClassTeacherAssignment.teacher_id == teacher_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(
            status_code=403, 
            detail="Forbidden: Current user is not assigned as a Class Teacher to any active stream."
        )
    return assignment

# --- Endpoints ---

@router.get("/my-managed-stream")
async def get_managed_stream_details(
    # Replace with your actual auth dependency (e.g., current_user: User = Depends(get_current_user))
    teacher_id: int = 1 
):
    async with async_session_maker() as db:
        assignment = await get_managed_class(teacher_id, db)
        
        # Get all students enrolled in this specific grade and stream section
        student_result = await db.execute(
            select(Student).filter(
                Student.school_id == assignment.school_id,
                Student.grade == assignment.grade_level,
                Student.status == "active"
            )
        )
        students = student_result.scalars().all()
        
        return {
            "stream_info": {
                "grade_level": assignment.grade_level,
                "stream_section": assignment.stream_section
            },
            "students": [
                {
                    "id": s.id,
                    "first_name": s.first_name,
                    "last_name": s.last_name,
                    "admission_number": s.admission_number,
                    "current_balance": 25000 # Example fee balance fallback
                } for s in students
            ]
        }

@router.post("/attendance/batch")
async def submit_batch_attendance(
    payload: AttendanceBatchPayload, 
    teacher_id: int = 1
):
    async with async_session_maker() as db:
        assignment = await get_managed_class(teacher_id, db)
        
        for entry in payload.entries:
            # Upsert attendance using PostgreSQL INSERT ... ON CONFLICT
            stmt = insert(DailyAttendance).values(
                school_id=assignment.school_id,
                student_id=entry.student_id,
                date=payload.date,
                status=entry.status,
                remarks=entry.remarks,
                recorded_by=teacher_id
            ).on_conflict_do_update(
                index_elements=['student_id', 'date'],
                set_={
                    'status': entry.status,
                    'remarks': entry.remarks,
                    'recorded_by': teacher_id
                }
            )
            await db.execute(stmt)
            
        await db.commit()
        return {"status": "success", "message": "Batch attendance submitted successfully."}

@router.post("/remarks")
async def submit_term_remarks(payload: RemarkPayload, teacher_id: int = 1):
    async with async_session_maker() as db:
        assignment = await get_managed_class(teacher_id, db)
        
        stmt = insert(ClassTeacherRemark).values(
            school_id=assignment.school_id,
            student_id=payload.student_id,
            term=payload.term,
            remarks=payload.remarks,
            recorded_by=teacher_id
        ).on_conflict_do_update(
            index_elements=['student_id', 'academic_year_id', 'term'],
            set_={'remarks': payload.remarks, 'recorded_by': teacher_id}
        )
        
        await db.execute(stmt)
        await db.commit()
        return {"status": "success", "message": "Term report card remarks saved successfully."}

@router.post("/escalate")
async def escalate_student_concern(payload: EscalationPayload, teacher_id: int = 1):
    async with async_session_maker() as db:
        assignment = await get_managed_class(teacher_id, db)
        
        escalation = StudentWelfareEscalation(
            school_id=assignment.school_id,
            student_id=payload.student_id,
            escalated_by=teacher_id,
            reason=payload.reason,
            details=payload.details
        )
        
        db.add(escalation)
        await db.commit()
        return {"status": "success", "message": "Student concern successfully escalated to administration."}