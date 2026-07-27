# server/assignments.py
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import Assignment, AssignmentSubmission, Course, Student, StudentCourseEnrollment, User

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
    current_user=Depends(get_current_user),
):
    """Create a new assignment for the current teacher's school, and seed a
    pending submission row for every student enrolled in the course so the
    teacher's grading view shows the full class roster from day one."""
    user, token_payload = current_user
    school_id = token_payload.get("school_id")

    if not school_id:
        raise HTTPException(status_code=403, detail="Access token is not scoped to a specific school")

    course_res = await db.execute(
        select(Course).where(Course.id == payload.course_id, Course.school_id == school_id)
    )
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Selected subject/course was not found.")

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
    await db.flush()  # get assignment.id without a second round trip

    enrolled_res = await db.execute(
        select(StudentCourseEnrollment.student_id).where(
            StudentCourseEnrollment.course_id == payload.course_id,
            StudentCourseEnrollment.school_id == school_id,
        )
    )
    for (student_id,) in enrolled_res.all():
        db.add(AssignmentSubmission(
            assignment_id=assignment.id,
            student_id=student_id,
            status="pending",
        ))

    await db.commit()
    await db.refresh(assignment)

    return {
        "data": {
            "id": assignment.id,
            "title": assignment.title,
            "course_id": assignment.course_id,
            "course_name": course.name,
            "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
            "status": assignment.status,
            "total_marks": assignment.total_marks,
        }
    }


@router.get("")
@router.get("/")
async def get_all_assignments(
    course_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Fetch this teacher's own assignments for their current school."""
    user, payload = current_user
    school_id = payload.get("school_id")

    if not school_id:
        return {"data": []}

    query = (
        select(Assignment, Course.name)
        .join(Course, Course.id == Assignment.course_id)
        .where(Assignment.school_id == school_id, Assignment.teacher_id == user.id)
    )
    if course_id is not None:
        query = query.where(Assignment.course_id == course_id)
    query = query.order_by(Assignment.due_date.desc().nullslast(), Assignment.created_at.desc())

    result = await db.execute(query)
    rows = result.all()

    data = []
    for assign, course_name in rows:
        submission_counts = await db.execute(
            select(AssignmentSubmission.status).where(AssignmentSubmission.assignment_id == assign.id)
        )
        statuses = [s for (s,) in submission_counts.all()]
        data.append({
            "id": assign.id,
            "title": assign.title,
            "course_id": assign.course_id,
            "course_name": course_name,
            "due_date": assign.due_date.isoformat() if assign.due_date else None,
            "status": assign.status,
            "assignment_type": assign.assignment_type,
            "total_marks": assign.total_marks,
            "total_students": len(statuses),
            "graded_count": sum(1 for s in statuses if s == "graded"),
            "submitted_count": sum(1 for s in statuses if s in ("submitted", "graded")),
        })

    return {"data": data}


@router.get("/{assignment_id}")
async def get_assignment_detail(assignment_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    """Fetch assignment details"""
    user, payload = current_user
    school_id = payload.get("school_id")

    result = await db.execute(
        select(Assignment, Course.name)
        .join(Course, Course.id == Assignment.course_id)
        .where(
            Assignment.id == assignment_id,
            Assignment.school_id == school_id,
        )
    )
    row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found")

    assignment, course_name = row

    return {
        "data": {
            "id": assignment.id,
            "title": assignment.title,
            "course_id": assignment.course_id,
            "course_name": course_name,
            "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
            "status": assignment.status,
            "description": assignment.description,
            "instructions": assignment.instructions,
            "assignment_type": assignment.assignment_type,
            "total_marks": assignment.total_marks,
        }
    }


@router.delete("/{assignment_id}")
async def delete_assignment(assignment_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    user, payload = current_user
    school_id = payload.get("school_id")

    result = await db.execute(
        select(Assignment).where(
            Assignment.id == assignment_id,
            Assignment.school_id == school_id,
            Assignment.teacher_id == user.id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    await db.delete(assignment)
    await db.commit()
    return {"message": "Assignment deleted."}


@router.get("/{assignment_id}/submissions")
async def get_assignment_submissions(assignment_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    """Fetch all submissions for an assignment (includes pending students who haven't submitted yet)."""
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
            "student_id": sub.student_id,
            "first_name": student.first_name if student else "Unknown",
            "last_name": student.last_name if student else "Student",
            "admission_number": student.admission_number if student else None,
            "status": sub.status,
            "score": sub.grade,
            "max_grade": sub.max_grade,
            "is_late": sub.is_late,
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
            "submission_text": sub.submission_text,
            "feedback": sub.feedback,
        })

    return {"data": data}


@router.post("/submissions/{submission_id}/grade")
async def grade_submission(
    submission_id: int,
    payload: GradeSubmissionRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
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
