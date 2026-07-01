from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import Student, FeePayment, StudentFee
from auth import get_current_school

router = APIRouter(prefix="/api/reports", tags=["Reports"])

@router.get("/financial-summary")
async def get_financial_summary(
    db: AsyncSession = Depends(get_db), 
    current_school = Depends(get_current_school)
):
    # Total revenue collected
    collected_query = await db.execute(
        select(func.sum(FeePayment.amount)).where(FeePayment.school_id == current_school.id)
    )
    total_collected = collected_query.scalar() or 0

    # Total outstanding dues (amount_due - amount_paid - amount_discount)
    due_query = await db.execute(
        select(func.sum(StudentFee.amount_due - StudentFee.amount_paid - StudentFee.amount_discount))
        .where(StudentFee.school_id == current_school.id, StudentFee.payment_status != 'paid')
    )
    total_due = due_query.scalar() or 0

    return {
        "success": True,
        "data": {
            "collected": float(total_collected),
            "outstanding": float(total_due)
        }
    }

@router.get("/school-analytics")
async def get_school_analytics(
    db: AsyncSession = Depends(get_db), 
    current_school = Depends(get_current_school)
):
    # Get total active students
    student_query = await db.execute(
        select(func.count(Student.id)).where(Student.school_id == current_school.id, Student.status == 'active')
    )
    total_students = student_query.scalar() or 0

    return {
        "success": True,
        "data": {
            "total_students": total_students,
            # Add staff counts, active courses, etc., similarly here
        }
    }