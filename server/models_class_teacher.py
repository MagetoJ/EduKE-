from sqlalchemy import Column, Integer, String, ForeignKey, Date, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class DailyAttendance(Base):
    __tablename__ = "daily_attendance"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id", ondelete="SET NULL"), nullable=True)
    date = Column(Date, nullable=False, default=datetime.utcnow().date)
    status = Column(String(20), nullable=False) # present, absent, late
    remarks = Column(Text, nullable=True)
    recorded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student")


class ClassTeacherRemark(Base):
    __tablename__ = "class_teacher_remarks"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id", ondelete="SET NULL"), nullable=True)
    term = Column(Integer, nullable=False) # 1, 2, or 3
    remarks = Column(Text, nullable=False)
    recorded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student")


class StudentWelfareEscalation(Base):
    __tablename__ = "student_welfare_escalations"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    escalated_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reason = Column(String(255), nullable=False)
    details = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pending") # pending, under_review, resolved
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student")
    escalated_by_user = relationship("User")


class ClassProgressReport(Base):
    """
    A teacher's periodic report on a specific Course they teach: what was
    covered, how much of the syllabus is done, and any blockers. This is
    what feeds the HOD dashboard's syllabus coverage numbers -- replacing
    what was previously a fake, deterministically-generated placeholder.
    """
    __tablename__ = "class_progress_reports"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    week_start_date = Column(Date, nullable=False, default=datetime.utcnow().date)
    topics_covered = Column(Text, nullable=False)
    syllabus_coverage_percent = Column(Integer, nullable=False, default=0)
    challenges = Column(Text, nullable=True)
    blockers = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course", back_populates="progress_reports")
    teacher = relationship("User")
    comments = relationship("ProgressReportComment", back_populates="report", cascade="all, delete-orphan")


class ProgressReportComment(Base):
    """A single message in the HOD <-> Teacher feedback thread on a ClassProgressReport."""
    __tablename__ = "progress_report_comments"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    report_id = Column(Integer, ForeignKey("class_progress_reports.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    comment = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    report = relationship("ClassProgressReport", back_populates="comments")
    author = relationship("User")