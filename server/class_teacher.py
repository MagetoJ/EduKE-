from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from typing import List
from pydantic import BaseModel
from datetime import date

from database import get_db
from models import User, Student, Notification
from models_roles import ClassTeacherAssignment
from models_class_teacher import DailyAttendance, ClassTeacherRemark, StudentWelfareEscalation
from auth import get_current_user # Resolves authenticated session context
from reporting import get_teacher_hods

router = APIRouter(prefix="/api/class-teacher", tags=["Class Teacher Workloads"])

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

async def get_managed_class(teacher_id: int, db: AsyncSession) -> ClassTeacherAssignment:
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

@router.get("/my-managed-stream")
async def get_managed_stream_details(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    assignment = await get_managed_class(current_user.id, db)
    
    # Restrict query strictly to the teacher's grade AND stream section
    student_result = await db.execute(
        select(Student).filter(
            Student.school_id == assignment.school_id,
            Student.grade == assignment.grade_level,
            Student.stream_section == assignment.stream_section,
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
                "current_balance": s.current_balance
            } for s in students
        ]
    }

@router.post("/attendance/batch")
async def submit_batch_attendance(
    payload: AttendanceBatchPayload, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    assignment = await get_managed_class(current_user.id, db)
    
    for entry in payload.entries:
        stmt = insert(DailyAttendance).values(
            school_id=assignment.school_id,
            student_id=entry.student_id,
            date=payload.date,
            status=entry.status,
            remarks=entry.remarks,
            recorded_by=current_user.id
        ).on_conflict_do_update(
            index_elements=['student_id', 'date'],
            set_={
                'status': entry.status,
                'remarks': entry.remarks,
                'recorded_by': current_user.id
            }
        )
        await db.execute(stmt)
        
    await db.commit()
    return {"status": "success", "message": "Batch attendance submitted successfully."}

@router.post("/remarks")
async def submit_term_remarks(
    payload: RemarkPayload, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    assignment = await get_managed_class(current_user.id, db)
    
    stmt = insert(ClassTeacherRemark).values(
        school_id=assignment.school_id,
        student_id=payload.student_id,
        term=payload.term,
        remarks=payload.remarks,
        recorded_by=current_user.id
    ).on_conflict_do_update(
        index_elements=['student_id', 'academic_year_id', 'term'],
        set_={'remarks': payload.remarks, 'recorded_by': current_user.id}
    )
    
    await db.execute(stmt)
    await db.commit()
    return {"status": "success", "message": "Term report card remarks saved successfully."}

@router.post("/escalate")
async def escalate_student_concern(
    payload: EscalationPayload, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    assignment = await get_managed_class(current_user.id, db)
    
    escalation = StudentWelfareEscalation(
        school_id=assignment.school_id,
        student_id=payload.student_id,
        escalated_by=current_user.id,
        reason=payload.reason,
        details=payload.details
    )
    db.add(escalation)

    # Notify the HOD(s) this class teacher reports to. Class teachers are
    # assigned by the Admin and have no department link of their own, so
    # get_teacher_hods() falls back to every HOD in the school if it can't
    # find a specific one - better an escalation reaches everyone than nobody.
    hods, _ = await get_teacher_hods(db, current_user.id, assignment.school_id)
    student_res = await db.execute(select(Student).where(Student.id == payload.student_id))
    student = student_res.scalar_one_or_none()
    student_name = f"{student.first_name} {student.last_name}" if student else "a student"
    for hod in hods:
        db.add(Notification(
            school_id=assignment.school_id,
            user_id=hod["id"],
            title="Student Welfare Escalation",
            message=f"{current_user.full_name} escalated a concern about {student_name}: {payload.reason}",
            notification_type="warning",
            link_url="/dashboard/hod"
        ))

    await db.commit()
    return {"status": "success", "message": "Student concern successfully escalated."}