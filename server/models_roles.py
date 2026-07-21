from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class AcademicDepartment(Base):
    __tablename__ = "academic_departments"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(20), nullable=False)
    description = Column(String(500), nullable=True)
    hod_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    hod = relationship("User", foreign_keys=[hod_id])

    courses = relationship("Course", back_populates="department")
    members = relationship("DepartmentMembership", back_populates="department", cascade="all, delete-orphan")
class DepartmentMembership(Base):
    __tablename__ = "department_memberships"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    department_id = Column(Integer, ForeignKey("academic_departments.id", ondelete="CASCADE"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assigned_at = Column(DateTime, default=datetime.utcnow)

    # Database level constraints
    __table_args__ = (UniqueConstraint("department_id", "teacher_id", name="uq_dept_membership"),)

    # Relationships
    department = relationship("AcademicDepartment", back_populates="members")
    teacher = relationship("User", back_populates="department_memberships")
class ClassTeacherAssignment(Base):
    __tablename__ = "class_teacher_assignments"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    grade_level = Column(String(50), nullable=False)
    stream_section = Column(String(20), nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime, default=datetime.utcnow)

    teacher = relationship("User", foreign_keys=[teacher_id])


class CbcCoordinatorAssignment(Base):
    __tablename__ = "cbc_coordinator_assignments"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    coordinator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    grade_band_id = Column(Integer, ForeignKey("cbc_grade_bands.id", ondelete="CASCADE"), nullable=False)
    assigned_at = Column(DateTime, default=datetime.utcnow)

    coordinator = relationship("User", foreign_keys=[coordinator_id])
    
    #  FIX: Change "CbcGradeBand" to "GradeBand" to match the actual class definition in models.py
    grade_band = relationship("GradeBand")


class ClassSubjectAssignment(Base):
    """
    Durable record of which teacher teaches a given SUBJECT (Course row) to a
    given CLASS (grade + stream), independent of the weekly timetable.

    This is the source of truth the HOD's "assign subject to teacher" screen
    manages, and is what enforces the two business rules:
      1. A class (grade + stream) can only have ONE teacher for a given
         subject at a time -- enforced by the unique constraint below.
      2. A teacher may teach several classes, but at most 2 distinct
         subjects overall -- enforced in the /class-assignments/assign
         endpoint (application-level, since it's a COUNT-based rule that a
         plain column constraint can't express).

    stream_section is intentionally NOT NULL (default "") rather than
    nullable: Postgres treats NULL as distinct from NULL for uniqueness
    purposes, so a nullable stream_section would silently defeat the unique
    constraint for un-streamed classes.
    """
    __tablename__ = "class_subject_assignments"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    grade_level = Column(String(50), nullable=False)
    stream_section = Column(String(20), nullable=False, default="")

    assigned_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("course_id", "grade_level", "stream_section", name="uq_one_teacher_per_class_subject"),
    )

    course = relationship("Course")
    teacher = relationship("User", foreign_keys=[teacher_id])