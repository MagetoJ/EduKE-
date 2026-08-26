# server/clinic.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from .database import get_db # Assuming standard dependency injection
from .models import ClinicInventory, ClinicLog, StudentHealthProfile

router = APIRouter(prefix="/api/clinic", tags=["clinic"])

@router.post("/dispense")
def dispense_medication(
    student_id: str, 
    nurse_id: str, 
    medication_id: str, 
    amount: int, 
    db: Session = Depends(get_db)
):
    # 1. Fetch inventory item
    inventory_item = db.query(ClinicInventory).filter(ClinicInventory.medication_id == medication_id).first()
    
    if not inventory_item:
        raise HTTPException(status_code=404, detail="Medication not found")
        
    if inventory_item.current_stock < amount:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    try:
        # 2. Deduct from inventory
        inventory_item.current_stock -= amount

        # 3. Create Audit Log
        new_log = ClinicLog(
            student_id=student_id,
            nurse_id=nurse_id,
            visit_type="Routine Medication",
            action_taken=f"Dispensed {amount} unit(s) of {inventory_item.medication_name}",
            medication_dispensed_id=medication_id
        )
        db.add(new_log)

        # 4. Check for low stock notification
        if inventory_item.current_stock <= inventory_item.low_stock_threshold:
            # Call your existing notification service here
            pass 

        db.commit()
        return {"success": True, "message": "Medication logged successfully"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))