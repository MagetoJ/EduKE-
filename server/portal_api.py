from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Dict, Any, Optional

from database import get_db
from models import (
    User, Student, Attendance, DisciplineRecord, 
    GradeEntry, ClassProgressReport, Assignment, 
    AssignmentSubmission, FeeInvoice, Payment, ParentStudentLink, School
)
from auth import get_current_user, get_current_school

router = APIRouter(prefix="/api", tags=["Student & Parent Portal Services"])

async def authorize_student_or_parent(
    student_id: int,
    current_user: User,
    current_school: School,
    db: AsyncSession
):
    """Validate that either the logged in student is accessing their own data, or their linked parent is."""
    if current_user.role == "student":
        stmt = select(Student).where(Student.user_id == current_user.id, Student.id == student_id)
        res = await db.execute(stmt)
        st = res.scalar_one_or_none()
        if not st:
            raise HTTPException(status_code=403, detail="Unauthorized access to student record.")
        return st

    elif current_user.role == "parent":
        stmt = (
            select(Student)
            .join(ParentStudentLink, ParentStudentLink.student_id == Student.id)
            .where(
                ParentStudentLink.parent_id == current_user.id,
                Student.id == student_id,
                Student.school_id == current_school.id
            )
        )
        res = await db.execute(stmt)
        st = res.scalar_one_or_none()
        if not st:
            raise HTTPException(status_code=403, detail="Unauthorized: Child not linked to parent.")
        return st

    else:
        raise HTTPException(status_code=403, detail="Role not permitted.")


@router.get("/students/me")
async def get_my_student_profile(
    db: AsyncSession = Depends(get_db),
    token_data = Depends(get_current_user),
    current_school: School = Depends(get_current_school)
):
    """Endpoint for logged-in Student to fetch their own profile."""
    current_user, _ = token_data
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can access /students/me")

    stmt = select(Student).where(Student.user_id == current_user.id, Student.school_id == current_school.id)
    res = await db.execute(stmt)
    student = res.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    return {"success": True, "data": student}


@router.get("/students/{student_id}/performance")
async def get_student_performance(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    token_data = Depends(get_current_user),
    current_school: School = Depends(get_current_school)
):
    """Fetches GradeEntry scores and ClassProgressReport remarks uploaded by teachers."""
    current_user, _ = token_data
    await authorize_student_or_parent(student_id, current_user, current_school, db)

    # Fetch Grade Entries (Exams/CATs)
    grades_stmt = select(GradeEntry).where(GradeEntry.student_id == student_id)
    grades_res = await db.execute(grades_stmt)
    grades = grades_res.scalars().all()

    # Fetch Class Teacher Remarks/Progress Reports
    reports_stmt = select(ClassProgressReport).where(ClassProgressReport.student_id == student_id)
    reports_res = await db.execute(reports_stmt)
    reports = reports_res.scalars().all()

    return {
        "success": True,
        "data": {
            "grades": grades,
            "teacher_remarks": reports
        }
    }


@router.get("/students/{student_id}/attendance")
async def get_student_attendance(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    token_data = Depends(get_current_user),
    current_school: School = Depends(get_current_school)
):
    """Fetches Attendance entries logged by class teachers."""
    current_user, _ = token_data
    await authorize_student_or_parent(student_id, current_user, current_school, db)

    stmt = select(Attendance).where(Attendance.student_id == student_id).order_by(Attendance.date.desc())
    res = await db.execute(stmt)
    records = res.scalars().all()

    # Summarize stats
    total = len(records)
    present = sum(1 for r in records if getattr(r, "status", "") == "present")
    absent = sum(1 for r in records if getattr(r, "status", "") == "absent")

    return {
        "success": True,
        "data": {
            "summary": {
                "total_days": total,
                "present_days": present,
                "absent_days": absent,
                "percentage": round((present / total * 100), 1) if total > 0 else 100.0
            },
            "history": records
        }
    }


@router.get("/students/{student_id}/fees")
async def get_student_fees(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    token_data = Depends(get_current_user),
    current_school: School = Depends(get_current_school)
):
    """Fetches Fee Invoices & Payments made for the student."""
    current_user, _ = token_data
    await authorize_student_or_parent(student_id, current_user, current_school, db)

    invoices_stmt = select(FeeInvoice).where(FeeInvoice.student_id == student_id)
    inv_res = await db.execute(invoices_stmt)
    invoices = inv_res.scalars().all()

    payments_stmt = select(Payment).where(Payment.student_id == student_id)
    pay_res = await db.execute(payments_stmt)
    payments = pay_res.scalars().all()

    total_billed = sum(getattr(i, "amount", 0.0) for i in invoices)
    total_paid = sum(getattr(p, "amount", 0.0) for p in payments)

    return {
        "success": True,
        "data": {
            "summary": {
                "total_billed": total_billed,
                "total_paid": total_paid,
                "balance": total_billed - total_paid
            },
            "invoices": invoices,
            "payments": payments
        }
    }


@router.get("/my-discipline")
async def get_my_discipline(
    db: AsyncSession = Depends(get_db),
    token_data = Depends(get_current_user),
    current_school: School = Depends(get_current_school)
):
    """Fetches discipline records logged by teachers for the current logged-in student or parent's child."""
    current_user, _ = token_data
    if current_user.role == "student":
        stmt_st = select(Student.id).where(Student.user_id == current_user.id)
        res = await db.execute(stmt_st)
        student_id = res.scalar_one_or_none()
        if not student_id:
            return {"success": True, "data": []}
        
        disc_stmt = select(DisciplineRecord).where(DisciplineRecord.student_id == student_id)
        disc_res = await db.execute(disc_stmt)
        return {"success": True, "data": disc_res.scalars().all()}

    else:
        raise HTTPException(status_code=400, detail="Use child-specific query for parents.")