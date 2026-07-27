from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class GuardianContact(Base):
    """A parent/guardian contact for a student. A student can have more than
    one (e.g. mother + father); `is_primary` marks who to reach first."""
    __tablename__ = "guardian_contacts"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(150), nullable=False)
    relationship_label = Column(String(50), nullable=True)  # Mother, Father, Guardian, ...
    phone = Column(String(30), nullable=True)
    email = Column(String(150), nullable=True)
    is_primary = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student")


class GuardianMessage(Base):
    """
    A message a teacher sent to a student's guardian. This project has no
    SMS/email provider configured, so messages are recorded here as an
    in-app log/outbox rather than actually dispatched externally.
    """
    __tablename__ = "guardian_messages"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    guardian_contact_id = Column(Integer, ForeignKey("guardian_contacts.id", ondelete="SET NULL"), nullable=True)

    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    teacher = relationship("User")
    student = relationship("Student")
    guardian_contact = relationship("GuardianContact")
