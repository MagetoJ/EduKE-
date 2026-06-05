from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from database import get_db
from models import Student, FeeInvoice, Payment, CreditTransaction, School
from auth import get_current_school

router = APIRouter(prefix="/payments", tags=["Payments & Fees"])

# --- Schemas ---
class FeeInvoiceCreate(BaseModel):
    student_id: int
    title: str
    description: Optional[str] = None
    total_amount: float
    due_date: Optional[datetime] = None

class FeeInvoiceResponse(BaseModel):
    id: int
    student_id: int
    title: str
    total_amount: float
    paid_amount: float
    status: str
    created_at: datetime
    class Config:
        from_attributes = True

class PaymentCreate(BaseModel):
    student_id: int
    invoice_id: Optional[int] = None
    amount: float
    payment_method: str
    reference: Optional[str] = None

class PaymentResponse(BaseModel):
    id: int
    amount: float
    payment_method: str
    reference: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

# --- Routes ---

@router.post("/invoices", response_model=FeeInvoiceResponse)
async def create_invoice(
    data: FeeInvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """Create a new fee invoice for a student (Borrowing SmartBiz Sale logic)"""
    # 1. Verify student belongs to this school
    student_result = await db.execute(
        select(Student).where(Student.id == data.student_id, Student.school_id == current_school.id)
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found in this school")

    # 2. Create Invoice
    new_invoice = FeeInvoice(
        **data.dict(),
        school_id=current_school.id
    )
    db.add(new_invoice)
    
    # 3. Create Credit Transaction (SmartBiz Pattern: Fee increases balance/debt)
    new_tx = CreditTransaction(
        school_id=current_school.id,
        student_id=data.student_id,
        amount=data.total_amount,
        transaction_type="FEE",
        description=f"Invoiced: {data.title}"
    )
    db.add(new_tx)

    # 4. Update Student Balance
    student.current_balance += data.total_amount
    
    await db.commit()
    await db.refresh(new_invoice)
    return new_invoice

@router.post("/pay", response_model=PaymentResponse)
async def record_payment(
    data: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """Record a payment from a student (Borrowing SmartBiz Payment logic)"""
    # 1. Verify student
    student_result = await db.execute(
        select(Student).where(Student.id == data.student_id, Student.school_id == current_school.id)
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found in this school")

    # 2. Create Payment Record
    new_payment = Payment(
        **data.dict(),
        school_id=current_school.id
    )
    db.add(new_payment)

    # 3. Create Credit Transaction (SmartBiz Pattern: Payment decreases balance/debt)
    new_tx = CreditTransaction(
        school_id=current_school.id,
        student_id=data.student_id,
        amount=-data.amount, # Negative because it reduces the debt
        transaction_type="PAYMENT",
        description=f"Payment received via {data.payment_method}"
    )
    db.add(new_tx)

    # 4. Update Invoice Status if provided
    if data.invoice_id:
        invoice_result = await db.execute(
            select(FeeInvoice).where(FeeInvoice.id == data.invoice_id, FeeInvoice.school_id == current_school.id)
        )
        invoice = invoice_result.scalar_one_or_none()
        if invoice:
            invoice.paid_amount += data.amount
            if invoice.paid_amount >= invoice.total_amount:
                invoice.status = "paid"
            elif invoice.paid_amount > 0:
                invoice.status = "partial"

    # 5. Update Student Balance
    student.current_balance -= data.amount
    
    await db.commit()
    await db.refresh(new_payment)
    return new_payment

@router.get("/student/{student_id}/statement")
async def get_student_statement(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """Fetch financial history for a student (SmartBiz Statement logic)"""
    # 1. Verify student
    student_result = await db.execute(
        select(Student).where(Student.id == student_id, Student.school_id == current_school.id)
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # 2. Get Transactions
    tx_result = await db.execute(
        select(CreditTransaction).where(CreditTransaction.student_id == student_id).order_by(CreditTransaction.created_at.desc())
    )
    transactions = tx_result.scalars().all()

    return {
        "student_name": f"{student.first_name} {student.last_name}",
        "current_balance": student.current_balance,
        "history": transactions
    }
