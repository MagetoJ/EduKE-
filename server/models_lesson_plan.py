from sqlalchemy import Column, Integer, String, ForeignKey, Date, DateTime, Text, LargeBinary
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class LessonPlan(Base):
    """
    A teacher's scheme of work / lesson plan for a subject they teach.
    Can either be authored inline (title + objectives + content) or created
    by uploading a PDF (file_name/file_type/file_data populated instead).
    """
    __tablename__ = "lesson_plans"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True)

    title = Column(String(255), nullable=False)
    week_start_date = Column(Date, nullable=True)
    term = Column(String(20), nullable=True)

    objectives = Column(Text, nullable=True)
    content = Column(Text, nullable=True)

    # Optional PDF attachment, stored directly in the DB (no external
    # object-storage bucket is configured for this project yet).
    file_name = Column(String(255), nullable=True)
    file_type = Column(String(100), nullable=True)
    file_data = Column(LargeBinary, nullable=True)

    status = Column(String(20), nullable=False, default="draft")  # draft, submitted

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    teacher = relationship("User", foreign_keys=[teacher_id])
    course = relationship("Course", foreign_keys=[course_id])
