from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_school, require_roles
from database import get_db
from models import School, Student, User
from models_messaging import GuardianContact, GuardianMessage
from router.teacher_dashboard import _get_teacher_class_scopes

router = APIRouter(prefix="/api/teacher", tags=["Teacher Messaging"])

TEACHER_ROLES = ("teacher", "class_teacher")


async def _assert_can_access_student(db: AsyncSession, teacher_id: int, school_id: int, student: Student):
    homeroom_scope, subject_scopes = await _get_teacher_class_scopes(db, teacher_id, school_id)
    student_scope = (student.grade, student.stream_section)
    if student_scope != homeroom_scope and student_scope not in subject_scopes:
        raise HTTPException(
            status_code=403,
            detail="You can only manage guardians/messages for students in your homeroom or classes you teach.",
        )


async def _get_authorized_student(db: AsyncSession, student_id: int, teacher_id: int, school_id: int) -> Student:
    result = await db.execute(select(Student).where(Student.id == student_id, Student.school_id == school_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    await _assert_can_access_student(db, teacher_id, school_id, student)
    return student


# ==================== Guardian contacts ====================

class GuardianContactCreate(BaseModel):
    name: str
    relationship_label: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_primary: bool = False


class GuardianContactResponse(BaseModel):
    id: int
    name: str
    relationship_label: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    is_primary: bool


def _serialize_contact(c: GuardianContact) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "relationship_label": c.relationship_label,
        "phone": c.phone,
        "email": c.email,
        "is_primary": c.is_primary,
    }


@router.get("/students/{student_id}/guardians", response_model=List[GuardianContactResponse])
async def list_guardian_contacts(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    current_school: School = Depends(get_current_school),
):
    await _get_authorized_student(db, student_id, current_user.id, current_school.id)
    result = await db.execute(
        select(GuardianContact).where(
            GuardianContact.student_id == student_id,
            GuardianContact.school_id == current_school.id,
        ).order_by(GuardianContact.is_primary.desc(), GuardianContact.name)
    )
    return [_serialize_contact(c) for c in result.scalars().all()]


@router.post("/students/{student_id}/guardians", response_model=GuardianContactResponse)
async def add_guardian_contact(
    student_id: int,
    payload: GuardianContactCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    current_school: School = Depends(get_current_school),
):
    await _get_authorized_student(db, student_id, current_user.id, current_school.id)

    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Guardian name is required.")
    if not payload.phone and not payload.email:
        raise HTTPException(status_code=400, detail="Provide at least a phone number or an email for the guardian.")

    contact = GuardianContact(
        school_id=current_school.id,
        student_id=student_id,
        name=payload.name.strip(),
        relationship_label=payload.relationship_label,
        phone=payload.phone,
        email=payload.email,
        is_primary=payload.is_primary,
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return _serialize_contact(contact)


# ==================== Messages ====================

class MessageCreate(BaseModel):
    guardian_contact_id: Optional[int] = None
    subject: str
    body: str


class MessageResponse(BaseModel):
    id: int
    student_id: int
    student_name: str
    guardian_contact_id: Optional[int]
    guardian_name: Optional[str]
    subject: str
    body: str
    created_at: Optional[str]


def _serialize_message(m: GuardianMessage, student: Student, guardian: Optional[GuardianContact]) -> dict:
    return {
        "id": m.id,
        "student_id": m.student_id,
        "student_name": f"{student.first_name} {student.last_name}" if student else "Unknown student",
        "guardian_contact_id": m.guardian_contact_id,
        "guardian_name": guardian.name if guardian else None,
        "subject": m.subject,
        "body": m.body,
        "created_at": m.created_at.strftime("%Y-%m-%d %H:%M") if m.created_at else None,
    }


@router.post("/students/{student_id}/messages", response_model=MessageResponse)
async def send_guardian_message(
    student_id: int,
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    current_school: School = Depends(get_current_school),
):
    """
    Logs a message to a student's guardian. NOTE: this project has no
    SMS/email provider configured, so this records the message as an
    in-app outbox entry rather than dispatching it externally.
    """
    student = await _get_authorized_student(db, student_id, current_user.id, current_school.id)

    if not payload.subject.strip() or not payload.body.strip():
        raise HTTPException(status_code=400, detail="Subject and message body are required.")

    guardian = None
    if payload.guardian_contact_id is not None:
        guardian_res = await db.execute(
            select(GuardianContact).where(
                GuardianContact.id == payload.guardian_contact_id,
                GuardianContact.student_id == student_id,
                GuardianContact.school_id == current_school.id,
            )
        )
        guardian = guardian_res.scalar_one_or_none()
        if not guardian:
            raise HTTPException(status_code=404, detail="Guardian contact not found for this student.")

    message = GuardianMessage(
        school_id=current_school.id,
        teacher_id=current_user.id,
        student_id=student_id,
        guardian_contact_id=guardian.id if guardian else None,
        subject=payload.subject.strip(),
        body=payload.body.strip(),
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    return _serialize_message(message, student, guardian)


@router.get("/students/{student_id}/messages", response_model=List[MessageResponse])
async def list_student_messages(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    current_school: School = Depends(get_current_school),
):
    student = await _get_authorized_student(db, student_id, current_user.id, current_school.id)

    result = await db.execute(
        select(GuardianMessage).where(
            GuardianMessage.student_id == student_id,
            GuardianMessage.school_id == current_school.id,
        ).order_by(GuardianMessage.created_at.desc())
    )
    messages = result.scalars().all()

    guardian_ids = {m.guardian_contact_id for m in messages if m.guardian_contact_id}
    guardians = {}
    if guardian_ids:
        g_res = await db.execute(select(GuardianContact).where(GuardianContact.id.in_(guardian_ids)))
        guardians = {g.id: g for g in g_res.scalars().all()}

    return [_serialize_message(m, student, guardians.get(m.guardian_contact_id)) for m in messages]


@router.get("/messages", response_model=List[MessageResponse])
async def list_my_sent_messages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    current_school: School = Depends(get_current_school),
):
    """Full outbox of messages this teacher has sent to guardians, across all their students."""
    result = await db.execute(
        select(GuardianMessage).where(
            GuardianMessage.teacher_id == current_user.id,
            GuardianMessage.school_id == current_school.id,
        ).order_by(GuardianMessage.created_at.desc())
    )
    messages = result.scalars().all()

    student_ids = {m.student_id for m in messages}
    students = {}
    if student_ids:
        s_res = await db.execute(select(Student).where(Student.id.in_(student_ids)))
        students = {s.id: s for s in s_res.scalars().all()}

    guardian_ids = {m.guardian_contact_id for m in messages if m.guardian_contact_id}
    guardians = {}
    if guardian_ids:
        g_res = await db.execute(select(GuardianContact).where(GuardianContact.id.in_(guardian_ids)))
        guardians = {g.id: g for g in g_res.scalars().all()}

    return [
        _serialize_message(m, students.get(m.student_id), guardians.get(m.guardian_contact_id))
        for m in messages
    ]
