from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime

class AttendanceSummary(BaseModel):
    total_days: int
    present_days: int
    absent_days: int
    late_days: int
    attendance_rate: float

class AssignmentPortalView(BaseModel):
    id: int
    title: str
    subject_name: str
    teacher_name: str
    due_date: date
    description: Optional[str]
    submitted: bool
    grade_score: Optional[float]
    teacher_feedback: Optional[str]

class CBCAssessmentResponse(BaseModel):
    subject_name: str
    assessment_rubric: str
    teacher_remarks: Optional[str]
    term: int
    year: int

class StudentOverviewResponse(BaseModel):
    student_id: int
    student_name: str
    class_name: str
    attendance: AttendanceSummary
    recent_assignments: List[AssignmentPortalView]
    latest_assessments: List[CBCAssessmentResponse]