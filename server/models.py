from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, Enum as SQLEnum, Table, UniqueConstraint, Index, Date, JSON, Time
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
    # Add frontend form functional matches:
    CLASS_TEACHER = "class_teacher"
    REGISTRAR = "registrar"
    EXAM_OFFICER = "exam_officer"
    HOD = "hod"
    TIMETABLE_MANAGER = "timetable_manager"
    TRANSPORT_MANAGER = "transport_manager"
    BOARDING_MASTER = "boarding_master"
    CBC_COORDINATOR = "cbc_coordinator"
    HR_MANAGER = "hr_manager"
    ADMISSION_OFFICER = "admission_officer"
    NURSE = "nurse"
    COUNSELOR = "counselor"
    LIBRARIAN = "librarian"

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
    
    # Special Needs Track Parameters
    is_special_needs = Column(Boolean, default=False, nullable=False)
    disability_category = Column(String(50), default="none", nullable=False)
    
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

# ==================== TRANSPORT MANAGEMENT ====================

class TransportRoute(Base):
    __tablename__ = "transport_routes"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    route_name = Column(String(255), nullable=False)
    route_code = Column(String(50))
    start_location = Column(String(255))
    end_location = Column(String(255))
    pickup_time = Column(Time)
    dropoff_time = Column(Time)
    vehicle_type = Column(String(50))
    capacity = Column(Integer)
    driver_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    fare_amount = Column(Float)
    status = Column(String(20), default="active")
    
    created_at = Column(DateTime, default=datetime.utcnow)

    school = relationship("School")
    enrollments = relationship("TransportEnrollment", back_populates="route")

class TransportEnrollment(Base):
    __tablename__ = "transport_enrollments"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    route_id = Column(Integer, ForeignKey("transport_routes.id", ondelete="CASCADE"), nullable=False)
    
    amount_due = Column(Float)
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

    school = relationship("School")
    student = relationship("Student")
    route = relationship("TransportRoute", back_populates="enrollments")


# ==================== BOARDING MANAGEMENT ====================

class BoardingHouse(Base):
    __tablename__ = "boarding_houses"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    house_name = Column(String(255), nullable=False)
    house_code = Column(String(50))
    capacity = Column(Integer)
    gender_type = Column(String(20)) # boys, girls, mixed
    fee_amount = Column(Float)
    status = Column(String(20), default="active")
    
    house_master_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    deputy_master_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))

    created_at = Column(DateTime, default=datetime.utcnow)

    school = relationship("School")
    enrollments = relationship("BoardingEnrollment", back_populates="house")

class BoardingEnrollment(Base):
    __tablename__ = "boarding_enrollments"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    boarding_house_id = Column(Integer, ForeignKey("boarding_houses.id", ondelete="CASCADE"), nullable=False)
    room_id = Column(Integer) # Can be linked to a BoardingRoom model later
    academic_year_id = Column(Integer)
    
    amount_due = Column(Float)
    check_in_date = Column(Date)
    check_out_date = Column(Date)
    status = Column(String(20), default="active")

    school = relationship("School")
    student = relationship("Student")
    house = relationship("BoardingHouse", back_populates="enrollments")


# ==================== LIBRARY MANAGEMENT ====================

class LibraryBook(Base):
    __tablename__ = "library_books"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    
    title = Column(String(255), nullable=False)
    author = Column(String(255))
    isbn = Column(String(50))
    publisher = Column(String(100))
    publication_year = Column(Integer)
    
    category = Column(String(100))
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="SET NULL"))
    
    total_copies = Column(Integer, default=1)
    available_copies = Column(Integer, default=1)
    location_rack = Column(String(50))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    school = relationship("School")
    issues = relationship("LibraryIssue", back_populates="book")

class LibraryIssue(Base):
    __tablename__ = "library_issues"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    book_id = Column(Integer, ForeignKey("library_books.id", ondelete="CASCADE"), nullable=False)
    
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"))
    staff_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    
    issue_date = Column(Date, default=datetime.utcnow().date)
    due_date = Column(Date, nullable=False)
    return_date = Column(Date)
    
    status = Column(String(20), default="issued") # issued, returned, overdue, lost
    
    fine_amount = Column(Float, default=0.0)
    fine_paid = Column(Boolean, default=False)
    
    issued_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    book = relationship("LibraryBook", back_populates="issues")
    student = relationship("Student")
    staff = relationship("User", foreign_keys=[staff_id])
    issuer = relationship("User", foreign_keys=[issued_by])

# ==================== CORE ACADEMIC & E-LEARNING MODELS ====================

class AcademicYear(Base):
    __tablename__ = "academic_years"
    
    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100))
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    status = Column(String(20), default="upcoming")

class Term(Base):
    __tablename__ = "terms"
    
    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(50))
    term_number = Column(Integer)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(20), default="upcoming")

class Course(Base):
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    academic_year_id = Column(Integer, ForeignKey("academic_years.id", ondelete="SET NULL"))
    
    name = Column(String(255), nullable=False)
    code = Column(String(50))
    description = Column(Text)
    grade = Column(String(50))
    
    is_active = Column(Boolean, default=True)

class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id", ondelete="SET NULL"))
    term_id = Column(Integer, ForeignKey("terms.id", ondelete="SET NULL"))
    
    title = Column(String(255), nullable=False)
    description = Column(Text)
    instructions = Column(Text)
    
    assignment_type = Column(String(20), default="homework")
    total_marks = Column(Integer, default=100)
    weightage = Column(Float)
    
    assigned_date = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=False)
    late_submission_allowed = Column(Boolean, default=True)
    late_penalty_percent = Column(Float, default=10.00)
    
    attachment_url = Column(Text)
    status = Column(String(20), default="published")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    school = relationship("School")
    teacher = relationship("User")
    submissions = relationship("AssignmentSubmission", back_populates="assignment", cascade="all, delete-orphan")

class AssignmentSubmission(Base):
    __tablename__ = "assignment_submissions"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    
    submission_text = Column(Text)
    attachment_url = Column(Text)
    submitted_at = Column(DateTime)
    
    grade = Column(Float)
    max_grade = Column(Integer)
    graded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    graded_at = Column(DateTime)
    feedback = Column(Text)
    
    status = Column(String(20), default="pending")
    is_late = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assignment = relationship("Assignment", back_populates="submissions")
    student = relationship("Student")
    grader = relationship("User", foreign_keys=[graded_by])

# ==================== DISCIPLINE ====================

class DisciplineRecord(Base):
    """Student disciplinary incidents reported by teachers"""
    __tablename__ = "discipline_records"

    id            = Column(Integer, primary_key=True, index=True)
    school_id     = Column(Integer, ForeignKey("schools.id"), nullable=False)
    student_id    = Column(Integer, ForeignKey("students.id"), nullable=False)
    reported_by   = Column(Integer, ForeignKey("users.id"), nullable=False)
    incident_type = Column(String(100), nullable=False)
    severity      = Column(String(20), default="Minor")   # Minor | Moderate | Major
    description   = Column(Text)
    status        = Column(String(30), default="Open")    # Open | Resolved | Escalated
    date          = Column(Date, default=datetime.utcnow)
    created_at    = Column(DateTime, default=datetime.utcnow)

    student  = relationship("Student")
    reporter = relationship("User")