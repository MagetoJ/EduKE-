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