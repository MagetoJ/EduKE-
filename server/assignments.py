from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Assignment, AssignmentSubmission, User, Student
from auth import get_current_user
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/assignments", tags=["Assignments"])

# Pydantic schema for grading input
class GradeSubmissionRequest(BaseModel):
    grade: float
    feedback: Optional[str] = None

@router.get("/{assignment_id}")
def get_assignment_detail(assignment_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetch assignment details"""
    assignment = db.query(Assignment).filter(
        Assignment.id == assignment_id, 
        Assignment.school_id == current_user.school_id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    return {
        "data": {
            "id": assignment.id,
            "title": assignment.title,
            "course_name": "Mapped Course Name", 
            "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
            "status": assignment.status,
            "description": assignment.description,
            "instructions": assignment.instructions,
            "total_marks": assignment.total_marks
        }
    }

@router.get("/{assignment_id}/submissions")
def get_assignment_submissions(assignment_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetch all submissions for an assignment"""
    submissions = db.query(AssignmentSubmission).filter(AssignmentSubmission.assignment_id == assignment_id).all()
    
    result = []
    for sub in submissions:
        student = db.query(Student).filter(Student.id == sub.student_id).first()
        result.append({
            "id": sub.id,
            "first_name": student.first_name if student else "Unknown",
            "last_name": student.last_name if student else "Student",
            "status": sub.status,
            "score": sub.grade,
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
            "submission_text": sub.submission_text
        })
        
    return {"data": result}

@router.post("/submissions/{submission_id}/grade")
def grade_submission(
    submission_id: int, 
    payload: GradeSubmissionRequest, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Grade a specific submission and leave feedback"""
    submission = db.query(AssignmentSubmission).filter(AssignmentSubmission.id == submission_id).first()
    
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    submission.grade = payload.grade
    submission.feedback = payload.feedback
    submission.status = "graded"
    submission.graded_by = current_user.id
    submission.graded_at = datetime.utcnow()
    
    db.commit()
    return {"message": "Submission graded successfully", "data": {"id": submission.id, "score": submission.grade}}