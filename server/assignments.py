# server/assignments.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Assignment, AssignmentSubmission, User, Student
from auth import get_current_user
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/assignments", tags=["Assignments"])

class GradeSubmissionRequest(BaseModel):
    grade: float
    feedback: Optional[str] = None

class AssignmentCreate(BaseModel):
    title: str
    course_id: int
    due_date: str          # ISO date or datetime string, e.g. "2026-07-20T14:30"
    max_score: Optional[int] = 100
    assignment_type: Optional[str] = "homework"
    description: Optional[str] = None
    instructions: Optional[str] = None

@router.post("")
@router.post("/")
async def create_assignment(
    payload: AssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Create a new assignment for the current teacher's school"""
    user, token_payload = current_user
    school_id = token_payload.get("school_id")

    if not school_id:
        raise HTTPException(status_code=403, detail="Access token is not scoped to a specific school")

    try:
        due_date = datetime.fromisoformat(payload.due_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="due_date must be a valid ISO date or datetime string")

    assignment = Assignment(
        school_id=school_id,
        course_id=payload.course_id,
        teacher_id=user.id,
        title=payload.title,
        description=payload.description,
        instructions=payload.instructions,
        assignment_type=payload.assignment_type or "homework",
        total_marks=payload.max_score or 100,
        due_date=due_date,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    return {
        "data": {
            "id": assignment.id,
            "title": assignment.title,
            "course_id": assignment.course_id,
            "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
            "status": assignment.status,
            "total_marks": assignment.total_marks,
        }
    }

@router.get("")
@router.get("/")
async def get_all_assignments(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user)):
    """Fetch all assignments for the current user's school"""
    user, payload = current_user  # Unpack both user and the JWT payload
    school_id = payload.get("school_id") # Get school_id from the token
    
    if not school_id:
        return {"data": []}
        
    result = await db.execute(
        select(Assignment).where(Assignment.school_id == school_id)
    )
    assignments = result.scalars().all()
    
    data = []
    for assign in assignments:
        data.append({
            "id": assign.id,
            "title": assign.title,
            "due_date": assign.due_date.isoformat() if assign.due_date else None,
            "status": assign.status,
            "total_marks": assign.total_marks
        })
        
    return {"data": data}

@router.get("/{assignment_id}")
async def get_assignment_detail(assignment_id: int, db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user)):
    """Fetch assignment details"""
    user, payload = current_user
    school_id = payload.get("school_id")
    
    result = await db.execute(
        select(Assignment).where(
            Assignment.id == assignment_id, 
            Assignment.school_id == school_id
        )
    )
    assignment = result.scalar_one_or_none()
    
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
async def get_assignment_submissions(assignment_id: int, db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user)):
    """Fetch all submissions for an assignment"""
    result = await db.execute(
        select(AssignmentSubmission).where(AssignmentSubmission.assignment_id == assignment_id)
    )
    submissions = result.scalars().all()
    
    data = []
    for sub in submissions:
        student_result = await db.execute(
            select(Student).where(Student.id == sub.student_id)
        )
        student = student_result.scalar_one_or_none()
        
        data.append({
            "id": sub.id,
            "first_name": student.first_name if student else "Unknown",
            "last_name": student.last_name if student else "Student",
            "status": sub.status,
            "score": sub.grade,
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
            "submission_text": sub.submission_text
        })
        
    return {"data": data}

@router.post("/submissions/{submission_id}/grade")
async def grade_submission(
    submission_id: int, 
    payload: GradeSubmissionRequest, 
    db: AsyncSession = Depends(get_db), 
    current_user = Depends(get_current_user)
):
    """Grade a specific submission and leave feedback"""
    user, _ = current_user  # Only need the user ID here
    
    result = await db.execute(
        select(AssignmentSubmission).where(AssignmentSubmission.id == submission_id)
    )
    submission = result.scalar_one_or_none()
    
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    submission.grade = payload.grade
    submission.feedback = payload.feedback
    submission.status = "graded"
    submission.graded_by = user.id
    submission.graded_at = datetime.utcnow()
    
    await db.commit()
    return {"message": "Submission graded successfully", "data": {"id": submission.id, "score": submission.grade}}