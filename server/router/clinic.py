# server/router/clinic.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel

# Adjust these imports based on your exact EduKE project structure
from database import get_db
from models import ClinicInventory, ClinicLog, StudentHealthProfile
from models import Student # Assuming you have a core Student model

router = APIRouter(prefix="/api/clinic", tags=["clinic"])

# --- Pydantic Schemas for Request Validation ---
class DispenseRequest(BaseModel):
    student_id: str
    nurse_id: str
    medication_id: str
    amount: int

# --- API Endpoints ---

@router.get("/stats")
def get_clinic_stats(db: Session = Depends(get_db)):
    """
    Fetches the daily statistics for the Nurse Dashboard.
    """
    today = date.today()
    
    # 1. Count items where current_stock is at or below the low_stock_threshold
    low_stock_count = db.query(ClinicInventory).filter(
        ClinicInventory.current_stock <= ClinicInventory.low_stock_threshold
    ).count()

    # 2. Count total clinic logs created today
    total_visits_today = db.query(ClinicLog).filter(
        func.date(ClinicLog.timestamp) == today
    ).count()

    # 3. Pending meds (This would typically query a MedicationSchedule table)
    # For now, we return a mocked placeholder value to satisfy the UI
    pending_meds_count = 12 

    return {
        "pending_meds": pending_meds_count,
        "low_stock": low_stock_count,
        "total_visits": total_visits_today
    }


@router.get("/students/search")
def search_students(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    """
    Searches for students by name and attaches basic health profile flags.
    """
    search_pattern = f"%{q}%"
    
    # Join the core Student table with the StudentHealthProfile table
    results = db.query(Student, StudentHealthProfile).outerjoin(
        StudentHealthProfile, Student.id == StudentHealthProfile.student_id
    ).filter(
        (Student.first_name.ilike(search_pattern)) | 
        (Student.last_name.ilike(search_pattern))
    ).limit(10).all()

    response = []
    for student, profile in results:
        response.append({
            "student_id": str(student.id),
            "name": f"{student.first_name} {student.last_name}",
            # Fallback if your Student model uses a different field for class/grade
            "grade": getattr(student, 'current_class', 'N/A'), 
            "has_profile": profile is not None,
            "critical_allergies": profile.critical_allergies if profile else []
        })
    
    return response


@router.post("/dispense")
def dispense_medication(payload: DispenseRequest, db: Session = Depends(get_db)):
    """
    Deducts stock from inventory and creates an immutable clinic log.
    """
    # 1. Fetch inventory item
    inventory_item = db.query(ClinicInventory).filter(
        ClinicInventory.medication_id == payload.medication_id
    ).first()
    
    if not inventory_item:
        raise HTTPException(status_code=404, detail="Medication not found")
        
    if inventory_item.current_stock < payload.amount:
        raise HTTPException(status_code=400, detail="Insufficient stock to dispense")

    try:
        # 2. Deduct from inventory
        inventory_item.current_stock -= payload.amount

        # 3. Create Audit Log
        new_log = ClinicLog(
            student_id=payload.student_id,
            nurse_id=payload.nurse_id,
            visit_type="Routine Medication",
            action_taken=f"Dispensed {payload.amount} unit(s) of {inventory_item.medication_name}",
            medication_dispensed_id=payload.medication_id
        )
        db.add(new_log)

        # 4. Check for low stock notification (Optional: trigger email/SMS here)
        if inventory_item.current_stock <= inventory_item.low_stock_threshold:
            print(f"ALERT: Medication {inventory_item.medication_name} is running low.")

        db.commit()
        return {"success": True, "message": "Medication logged successfully"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")