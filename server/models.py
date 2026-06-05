from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, Enum as SQLEnum, Table, UniqueConstraint, Index, Date, JSON
from sqlalchemy.orm import relationship, backref
from datetime import datetime, timedelta
import enum
from database import Base

# ==================== ENUMS (Borrowed from SmartBiz) ====================

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    TEACHER = "teacher"
    STAFF = "staff"
    STUDENT = "student"
    PARENT = "parent"

class Permission(str, enum.Enum):
    """Feature-level permissions for RBAC (Expanded for EduKE)"""
    VIEW_DASHBOARD = "view_dashboard"
    VIEW_REPORTS = "view_reports"
    MANAGE_EXAMS = "manage_exams"
    VIEW_GRADES = "view_grades"
    MANAGE_INVENTORY = "manage_inventory"
    MANAGE_USERS = "manage_users"
    MANAGE_FEES = "manage_fees"
    MANAGE_TIMETABLE = "manage_timetable"
    MANAGE_ATTENDANCE = "manage_attendance"
    ISSUE_ASSETS = "issue_assets"

# ==================== ASSOCIATION TABLES ====================

# Links Users to Schools (Multi-tenancy logic from SmartBiz)
school_users = Table(
    'school_users',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('school_id', Integer, ForeignKey('schools.id', ondelete='CASCADE'), nullable=False),
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
    Column('role', SQLEnum(UserRole), default=UserRole.STUDENT, nullable=False),
    Column('is_active', Boolean, default=True),
    Column('joined_at', DateTime, default=datetime.utcnow),
    UniqueConstraint('school_id', 'user_id', name='uq_school_user')
)

# ==================== CORE MODELS ====================

class School(Base):
    """Multi-tenant School model (Equivalent to SmartBiz Tenant)"""
    __tablename__ = "schools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100))
    phone = Column(String(20))
    address = Column(Text)
    status = Column(String(20), default='active') # active, suspended, pending
    is_manually_blocked = Column(Boolean, default=False)
    
    # Subscription fields (SmartBiz pattern)
    subscription_plan = Column(String(20), default='trial') # trial, basic, professional
    trial_ends_at = Column(DateTime, default=lambda: datetime.utcnow() + timedelta(days=14))
    subscription_expires_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    users = relationship("User", secondary=school_users, back_populates="schools")
    students = relationship("Student", back_populates="school")
    assets = relationship("Asset", back_populates="school")
    invoices = relationship("FeeInvoice", back_populates="school")
    subjects = relationship("Subject", back_populates="school")
    exams = relationship("Exam", back_populates="school")
    timetable_slots = relationship("TimetableSlot", back_populates="school")
    audit_logs = relationship("AuditLog", back_populates="school")

class User(Base):
    """Unified User model with RBAC"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    is_super_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    schools = relationship("School", secondary=school_users, back_populates="users")

class Student(Base):
    """Student specific data linked to School tenant"""
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    grade = Column(String(20), nullable=False)
    current_balance = Column(Float, default=0.0) # Borrowed from SmartBiz Customer logic
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    school = relationship("School", back_populates="students")
    invoices = relationship("FeeInvoice", back_populates="student")
    payments = relationship("Payment", back_populates="student")
    credit_transactions = relationship("CreditTransaction", back_populates="student")

# ==================== ASSET MANAGEMENT (Borrowed from SmartBiz) ====================

class Asset(Base):
    """School assets like textbooks/equipment (Adapted from SmartBiz Product)"""
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    name = Column(String(100), nullable=False)
    sku = Column(String(50), index=True)  # Barcode/Serial Number
    quantity = Column(Integer, default=0)
    asset_type = Column(String(50))  # e.g., "Textbook", "Lab Equipment"

    # Relationships
    school = relationship("School", back_populates="assets")
    movements = relationship("AssetMovement", back_populates="asset")

class AssetMovement(Base):
    """Tracking assignment of assets (Adapted from SmartBiz StockMovement)"""
    __tablename__ = "asset_movements"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"))
    user_id = Column(Integer, ForeignKey("users.id")) # Teacher/Staff who moved it
    quantity = Column(Integer)
    movement_type = Column(String(20)) # "IN", "OUT"
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    asset = relationship("Asset", back_populates="movements")
    user = relationship("User")

# ==================== FEE & PAYMENT SYSTEM (Borrowed from SmartBiz) ====================

class FeeInvoice(Base):
    """Fee Invoice for a student (Equivalent to SmartBiz Sale/Invoice)"""
    __tablename__ = "fee_invoices"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    
    title = Column(String(100), nullable=False) # e.g., "Term 1 Tuition"
    description = Column(Text)
    total_amount = Column(Float, nullable=False)
    paid_amount = Column(Float, default=0.0)
    due_date = Column(DateTime)
    status = Column(String(20), default="unpaid") # unpaid, partial, paid, voided, overdue
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    school = relationship("School", back_populates="invoices")
    student = relationship("Student", back_populates="invoices")
    payments = relationship("Payment", back_populates="invoice")

class Payment(Base):
    """Payment record (Equivalent to SmartBiz Payment)"""
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    invoice_id = Column(Integer, ForeignKey("fee_invoices.id"), nullable=True)
    
    amount = Column(Float, nullable=False)
    payment_method = Column(String(50)) # MPESA, Cash, Bank Transfer
    reference = Column(String(100)) # M-Pesa Code / Receipt No
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    student = relationship("Student", back_populates="payments")
    invoice = relationship("FeeInvoice", back_populates="payments")

class CreditTransaction(Base):
    """Tracking student balance changes (Equivalent to SmartBiz CreditTransaction)"""
    __tablename__ = "credit_transactions"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    
    amount = Column(Float, nullable=False) # Positive for fees (debt), Negative for payments
    transaction_type = Column(String(20)) # "FEE", "PAYMENT"
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    student = relationship("Student", back_populates="credit_transactions")

# ==================== ACADEMIC SYSTEM (Exams, Timetables, Attendance) ====================

class Subject(Base):
    """Academic subjects (e.g., Mathematics, English)"""
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(20)) # e.g., MATH101
    
    # Relationships
    school = relationship("School", back_populates="subjects")
    exams = relationship("Exam", back_populates="subject")
    timetable_slots = relationship("TimetableSlot", back_populates="subject")

class Exam(Base):
    """Exams and Assessments"""
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    
    title = Column(String(100), nullable=False) # e.g., "End of Term 1"
    exam_date = Column(Date)
    max_score = Column(Float, default=100.0)
    term = Column(String(20)) # e.g., "Term 1"
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    school = relationship("School", back_populates="exams")
    subject = relationship("Subject", back_populates="exams")
    grades = relationship("GradeEntry", back_populates="exam")

class GradeEntry(Base):
    """Individual student marks for an exam"""
    __tablename__ = "grade_entries"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    
    score = Column(Float, nullable=False)
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    exam = relationship("Exam", back_populates="grades")
    student = relationship("Student")

class TimetableSlot(Base):
    """Weekly schedule slots"""
    __tablename__ = "timetable_slots"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id")) # Link to User with Teacher role
    
    day_of_week = Column(String(10)) # Monday, Tuesday, etc.
    start_time = Column(String(5)) # HH:MM (24h)
    end_time = Column(String(5))   # HH:MM (24h)
    room = Column(String(50))
    grade_level = Column(String(20)) # e.g., "Grade 1"

    # Relationships
    school = relationship("School", back_populates="timetable_slots")
    subject = relationship("Subject", back_populates="timetable_slots")
    teacher = relationship("User")

class Attendance(Base):
    """Daily or lesson-based attendance"""
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    
    date = Column(Date, default=datetime.utcnow().date())
    status = Column(String(20)) # PRESENT, ABSENT, LATE, EXCUSED
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    student = relationship("Student")

class LeaveRequest(Base):
    """Staff leave requests (SmartBiz pattern)"""
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    leave_type = Column(String(50), nullable=False) # e.g., "Sick", "Annual"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(Text)
    status = Column(String(20), default="pending") # pending, approved, rejected
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User")
    school = relationship("School")

class AuditLog(Base):
    """Activity Log for school operations (Borrowed from SmartBiz)"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    action = Column(String(50), nullable=False) # e.g., "update_grade", "issue_book"
    target_type = Column(String(50)) # e.g., "STUDENT", "EXAM"
    target_id = Column(Integer)
    details = Column(JSON) # Store before/after changes or extra info
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    school = relationship("School", back_populates="audit_logs")
    user = relationship("User")

class AdminActivityLog(Base):
    """Platform-wide audit logs for Super Admin actions (SmartBiz pattern)"""
    __tablename__ = "admin_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False) # e.g., "block_school", "delete_school", "change_plan"
    target_school_id = Column(Integer, ForeignKey("schools.id"), nullable=True)
    details = Column(JSON)
    ip_address = Column(String(45))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    admin = relationship("User")
    target_school = relationship("School")
