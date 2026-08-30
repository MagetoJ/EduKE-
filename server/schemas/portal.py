from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class AttendanceSummarySchema(BaseModel):
    total_days: int
    present_days: int
    absent_days: int
    late_days: int
    percentage: float

    class Config:
        from_attributes = True

class GradeEntrySchema(BaseModel):
    id: int
    subject_id: int
    score: float
    max_score: float
    exam_type: str

    class Config:
        from_attributes = True

class TeacherRemarkSchema(BaseModel):
    id: int
    term: int
    year: int
    remarks: str

    class Config:
        from_attributes = True

class FeeSummarySchema(BaseModel):
    total_billed: float
    total_paid: float
    balance: float
    
    class Config:
        from_attributes = True