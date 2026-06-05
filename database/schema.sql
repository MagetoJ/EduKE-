-- ============================================
-- EduKE Multi-Tenant School Management System
-- PostgreSQL Database Schema
-- ============================================

-- Enable UUID extension (optional, for future use)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- GLOBAL TABLES (No school_id)
-- ============================================

-- Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2),
    price_annual DECIMAL(10,2),
    student_limit INT,
    staff_limit INT,
    trial_duration_days INT DEFAULT 14,
    
    -- Feature flags
    include_parent_portal BOOLEAN DEFAULT FALSE,
    include_student_portal BOOLEAN DEFAULT FALSE,
    include_messaging BOOLEAN DEFAULT FALSE,
    include_finance BOOLEAN DEFAULT FALSE,
    include_advanced_reports BOOLEAN DEFAULT FALSE,
    include_leave_management BOOLEAN DEFAULT FALSE,
    include_ai_analytics BOOLEAN DEFAULT FALSE,
    
    is_trial BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_plan_slug ON subscription_plans(slug);

-- ============================================
-- SCHOOL (TENANT) TABLES
-- ============================================

-- Schools (Tenants)
CREATE TABLE IF NOT EXISTS schools (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Kenya',
    postal_code VARCHAR(20),
    
    -- School Configuration
    curriculum VARCHAR(20) DEFAULT 'cbc' CHECK (curriculum IN ('cbc', '844', 'british', 'american', 'ib')),
    level VARCHAR(100),
    principal VARCHAR(255),
    logo_url TEXT,
    primary_color VARCHAR(7),
    accent_color VARCHAR(7),
    
    -- Grade levels stored as JSON array
    grade_levels JSONB,
    
    -- Timestamps
    registration_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_school_slug ON schools(slug);
CREATE INDEX idx_school_status ON schools(status);
CREATE INDEX idx_school_curriculum ON schools(curriculum);

-- School Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    plan_id INT NOT NULL REFERENCES subscription_plans(id),
    
    status VARCHAR(20) DEFAULT 'trial' CHECK (status IN ('active', 'expired', 'cancelled', 'suspended', 'trial')),
    start_date DATE NOT NULL,
    end_date DATE,
    trial_ends_at TIMESTAMP,
    
    -- Billing
    next_billing_date DATE,
    billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'annual')),
    amount DECIMAL(10,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscription_school ON subscriptions(school_id);
CREATE INDEX idx_subscription_status ON subscriptions(status);
CREATE INDEX idx_subscription_expiry ON subscriptions(end_date);

-- ============================================
-- USER MANAGEMENT
-- ============================================

-- Users (Staff, Teachers, Parents, Students with portal access, Admins)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    school_id INT REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Authentication
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    name VARCHAR(255),
    phone VARCHAR(50),
    date_of_birth DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    address TEXT,
    avatar_url TEXT,
    
    -- Role & Access
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'admin', 'teacher', 'parent', 'student', 'registrar', 'timetable_manager', 'class_teacher', 'boarding_master', 'transport_manager', 'exam_officer', 'cbc_coordinator', 'hod', 'hr_manager', 'admission_officer', 'nurse')),
    department VARCHAR(100),
    subject VARCHAR(255),
    class_assigned VARCHAR(50),
    employee_id VARCHAR(50),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'archived')),
    is_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP,
    must_change_password BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP,
    
    -- MFA and Security
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    failed_login_attempts INT DEFAULT 0,
    last_failed_login_at TIMESTAMP,
    account_locked_until TIMESTAMP,
    
    -- Employment info (for staff/teachers)
    hire_date DATE,
    termination_date DATE,
    salary DECIMAL(10,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_user_school_role ON users(school_id, role);
CREATE INDEX idx_user_status ON users(status);

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_token_expiry ON password_reset_tokens(expires_at);

-- Email Verification Tokens
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verification_token ON email_verification_tokens(token_hash);

-- Refresh Tokens (JWT)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_token ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_expiry ON refresh_tokens(expires_at);

-- ============================================
-- STUDENT MANAGEMENT
-- ============================================

-- Students
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    parent_id INT REFERENCES users(id) ON DELETE SET NULL,
    
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    date_of_birth DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    address TEXT,
    avatar_url TEXT,
    
    -- Identification
    student_id_number VARCHAR(50),
    national_id VARCHAR(50),
    
    -- Academic Information
    grade VARCHAR(50) NOT NULL,
    class_section VARCHAR(10),
    enrollment_date DATE,
    graduation_date DATE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'transferred', 'graduated', 'retained', 'archived')),
    
    -- Emergency Contact
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    emergency_contact_relation VARCHAR(50),
    
    -- Medical Information
    medical_conditions TEXT,
    allergies TEXT,
    blood_type VARCHAR(5),
    
    -- Additional Info
    previous_school VARCHAR(255),
    transfer_reason TEXT,
    admission_number VARCHAR(50),
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(school_id, student_id_number)
);

CREATE INDEX idx_student_school ON students(school_id);
CREATE INDEX idx_student_grade ON students(grade);
CREATE INDEX idx_student_status ON students(status);
CREATE INDEX idx_student_parent ON students(parent_id);

-- Parent-Student Relations
CREATE TABLE IF NOT EXISTS parent_student_relations (
    id SERIAL PRIMARY KEY,
    parent_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    relation_type VARCHAR(20) DEFAULT 'guardian' CHECK (relation_type IN ('father', 'mother', 'guardian', 'other')),
    is_primary_contact BOOLEAN DEFAULT FALSE,
    is_financial_responsible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(parent_id, student_id)
);

CREATE INDEX idx_parent_relations ON parent_student_relations(parent_id);
CREATE INDEX idx_student_relations ON parent_student_relations(student_id);

-- ============================================
-- ACADEMIC YEAR & CURRICULUM
-- ============================================

-- Academic Years
CREATE TABLE IF NOT EXISTS academic_years (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    name VARCHAR(100),
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('active', 'completed', 'upcoming')),
    
    -- Promotion settings
    promotion_threshold DECIMAL(5,2) DEFAULT 50.00,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_academic_year_school ON academic_years(school_id);
CREATE INDEX idx_academic_year_status ON academic_years(status);

-- Terms/Semesters
CREATE TABLE IF NOT EXISTS terms (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id INT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    
    name VARCHAR(50),
    term_number INT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('active', 'completed', 'upcoming')),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_term_school ON terms(school_id);
CREATE INDEX idx_term_year ON terms(academic_year_id);

-- Courses/Subjects
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id INT REFERENCES users(id) ON DELETE SET NULL,
    academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
    
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    grade VARCHAR(50),
    subject_area VARCHAR(100),
    
    -- Schedule
    schedule TEXT,
    classroom VARCHAR(50),
    credits INT,
    
    -- Settings
    max_students INT,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(school_id, code)
);

CREATE INDEX idx_course_school ON courses(school_id);
CREATE INDEX idx_course_teacher ON courses(teacher_id);
CREATE INDEX idx_course_grade ON courses(grade);

-- Course Enrollments
CREATE TABLE IF NOT EXISTS course_enrollments (
    id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
    term_id INT REFERENCES terms(id) ON DELETE SET NULL,
    
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'completed', 'dropped', 'failed')),
    final_grade DECIMAL(5,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(course_id, student_id, term_id)
);

CREATE INDEX idx_enrollment_course ON course_enrollments(course_id);
CREATE INDEX idx_enrollment_student ON course_enrollments(student_id);

-- Course Resources
CREATE TABLE IF NOT EXISTS course_resources (
    id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    description TEXT,
    resource_type VARCHAR(20) DEFAULT 'document' CHECK (resource_type IN ('document', 'video', 'link', 'file', 'other')),
    url TEXT,
    file_path TEXT,
    file_size INT,
    mime_type VARCHAR(100),
    
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_resource_course ON course_resources(course_id);

-- ============================================
-- ASSIGNMENTS & SUBMISSIONS
-- ============================================

-- Assignments
CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
    term_id INT REFERENCES terms(id) ON DELETE SET NULL,
    
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    
    -- Assignment Details
    assignment_type VARCHAR(20) DEFAULT 'homework' CHECK (assignment_type IN ('homework', 'project', 'quiz', 'lab', 'essay', 'other')),
    total_marks INT DEFAULT 100,
    weightage DECIMAL(5,2),
    
    -- Dates
    assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP NOT NULL,
    late_submission_allowed BOOLEAN DEFAULT TRUE,
    late_penalty_percent DECIMAL(5,2) DEFAULT 10.00,
    
    -- Attachments
    attachment_url TEXT,
    
    status VARCHAR(20) DEFAULT 'published' CHECK (status IN ('draft', 'published', 'closed')),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assignment_school ON assignments(school_id);
CREATE INDEX idx_assignment_course ON assignments(course_id);
CREATE INDEX idx_assignment_due_date ON assignments(due_date);

-- Assignment Submissions
CREATE TABLE IF NOT EXISTS assignment_submissions (
    id SERIAL PRIMARY KEY,
    assignment_id INT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    
    submission_text TEXT,
    attachment_url TEXT,
    submitted_at TIMESTAMP,
    
    -- Grading
    grade DECIMAL(5,2),
    max_grade INT,
    graded_by INT REFERENCES users(id) ON DELETE SET NULL,
    graded_at TIMESTAMP,
    feedback TEXT,
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'late', 'graded', 'returned')),
    is_late BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(assignment_id, student_id)
);

CREATE INDEX idx_submission_assignment ON assignment_submissions(assignment_id);
CREATE INDEX idx_submission_student ON assignment_submissions(student_id);
CREATE INDEX idx_submission_status ON assignment_submissions(status);

-- ============================================
-- EXAMINATIONS
-- ============================================

-- Exams
CREATE TABLE IF NOT EXISTS exams (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
    term_id INT REFERENCES terms(id) ON DELETE SET NULL,
    
    title VARCHAR(255) NOT NULL,
    exam_type VARCHAR(20) DEFAULT 'test' CHECK (exam_type IN ('midterm', 'final', 'quiz', 'test', 'practical', 'cat')),
    description TEXT,
    
    -- Exam Details
    total_marks INT DEFAULT 100,
    passing_marks INT DEFAULT 40,
    duration_minutes INT,
    
    -- Schedule
    exam_date DATE,
    start_time TIME,
    end_time TIME,
    venue VARCHAR(255),
    
    -- Question Paper & Resources
    question_paper_url TEXT,
    answer_key_url TEXT,
    
    -- Settings
    instructions TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
    
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exam_school ON exams(school_id);
CREATE INDEX idx_exam_course ON exams(course_id);
CREATE INDEX idx_exam_date ON exams(exam_date);

-- Exam Results
CREATE TABLE IF NOT EXISTS exam_results (
    id SERIAL PRIMARY KEY,
    exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    
    marks_obtained DECIMAL(5,2) NOT NULL,
    total_marks INT NOT NULL,
    percentage DECIMAL(5,2),
    grade VARCHAR(5),
    
    remarks TEXT,
    graded_by INT REFERENCES users(id) ON DELETE SET NULL,
    graded_at TIMESTAMP,
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('absent', 'pending', 'graded', 'published')),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(exam_id, student_id)
);

CREATE INDEX idx_result_exam ON exam_results(exam_id);
CREATE INDEX idx_result_student ON exam_results(student_id);

-- ============================================
-- ATTENDANCE
-- ============================================

-- Attendance Records
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id INT REFERENCES courses(id) ON DELETE SET NULL,
    
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    
    check_in_time TIME,
    check_out_time TIME,
    remarks TEXT,
    
    recorded_by INT REFERENCES users(id) ON DELETE SET NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(student_id, date, course_id)
);

CREATE INDEX idx_attendance_school ON attendance(school_id);
CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_attendance_date ON attendance(date);

-- ============================================
-- PERFORMANCE & GRADING
-- ============================================

-- Student Performance Records
CREATE TABLE IF NOT EXISTS performance (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id INT REFERENCES courses(id) ON DELETE SET NULL,
    academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
    term_id INT REFERENCES terms(id) ON DELETE SET NULL,
    
    subject VARCHAR(100),
    grade DECIMAL(5,2) NOT NULL,
    max_grade INT DEFAULT 100,
    
    assessment_type VARCHAR(20) CHECK (assessment_type IN ('assignment', 'exam', 'quiz', 'project', 'continuous', 'other')),
    remarks TEXT,
    
    recorded_by INT REFERENCES users(id) ON DELETE SET NULL,
    date_recorded DATE DEFAULT CURRENT_DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_performance_student ON performance(student_id);
CREATE INDEX idx_performance_course ON performance(course_id);
CREATE INDEX idx_performance_term ON performance(term_id);

-- Report Cards
CREATE TABLE IF NOT EXISTS report_cards (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    academic_year_id INT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    term_id INT REFERENCES terms(id) ON DELETE SET NULL,
    
    overall_grade DECIMAL(5,2),
    overall_percentage DECIMAL(5,2),
    rank_in_class INT,
    total_students INT,
    
    attendance_percentage DECIMAL(5,2),
    conduct_grade VARCHAR(5),
    teacher_remarks TEXT,
    principal_remarks TEXT,
    
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    generated_by INT REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE(student_id, academic_year_id, term_id)
);

CREATE INDEX idx_report_student ON report_cards(student_id);
CREATE INDEX idx_report_year_term ON report_cards(academic_year_id, term_id);

CREATE TABLE IF NOT EXISTS report_comments (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    term_id INT NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    teacher_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(school_id, student_id, term_id, teacher_id)
);

CREATE INDEX idx_report_comments_student ON report_comments(student_id);
CREATE INDEX idx_report_comments_term ON report_comments(term_id);

CREATE TABLE IF NOT EXISTS report_card_admin_comments (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    term_id INT NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    headmaster_comment TEXT,
    overall_conduct VARCHAR(50),
    next_term_focus TEXT,
    promoted BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(school_id, student_id, term_id)
);

CREATE INDEX idx_admin_comments_student ON report_card_admin_comments(student_id);
CREATE INDEX idx_admin_comments_term ON report_card_admin_comments(term_id);

CREATE TABLE IF NOT EXISTS discipline_records (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    term_id INT REFERENCES terms(id) ON DELETE SET NULL,
    incident_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) DEFAULT 'moderate',
    incident_date DATE NOT NULL,
    description TEXT,
    action_taken TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_discipline_records_student ON discipline_records(student_id);
CREATE INDEX idx_discipline_records_term ON discipline_records(term_id);

CREATE TABLE IF NOT EXISTS cbc_strands (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    grade_level VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, code)
);

CREATE INDEX idx_cbc_strand_school ON cbc_strands(school_id);

CREATE TABLE IF NOT EXISTS cbc_assessments (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    strand_id INT NOT NULL REFERENCES cbc_strands(id) ON DELETE CASCADE,
    assessment_type VARCHAR(20) CHECK (assessment_type IN ('formative', 'summative')),
    marks DECIMAL(5,2),
    grade INT CHECK (grade IN (1, 2, 3, 4)),
    comments TEXT,
    assessment_date DATE DEFAULT CURRENT_DATE,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cbc_assessment_school ON cbc_assessments(school_id);

CREATE TABLE IF NOT EXISTS cbc_learner_portfolios (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    artifact_type VARCHAR(50),
    artifact_title VARCHAR(255),
    artifact_url TEXT,
    comments TEXT,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cbc_portfolios_school ON cbc_learner_portfolios(school_id);

CREATE TABLE IF NOT EXISTS nemis_student_registration (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    upi VARCHAR(50),
    birth_certificate_no VARCHAR(50),
    registration_status VARCHAR(20) DEFAULT 'registered',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, student_id)
);

CREATE INDEX idx_nemis_school ON nemis_student_registration(school_id);

CREATE TABLE IF NOT EXISTS knec_candidate_registration (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_type VARCHAR(50) CHECK (exam_type IN ('KCSE', 'KCPE', 'KPSEA')),
    subjects JSONB,
    registration_number VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_knec_school ON knec_candidate_registration(school_id);

-- ============================================
-- CURRICULUM & SPECIALIZED ASSESSMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS grading_schemes (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    curriculum VARCHAR(50) NOT NULL,
    grade_letter VARCHAR(5) NOT NULL,
    min_score DECIMAL(5,2) NOT NULL,
    max_score DECIMAL(5,2) NOT NULL,
    points INT,
    remarks VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_grading_scheme_school ON grading_schemes(school_id);

CREATE TABLE IF NOT EXISTS assessment_844_system (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
    term_id INT REFERENCES terms(id) ON DELETE SET NULL,
    subject VARCHAR(100) NOT NULL,
    form VARCHAR(50),
    stream VARCHAR(50),
    marks_obtained DECIMAL(5,2),
    max_marks INT DEFAULT 100,
    grade_letter VARCHAR(5),
    points INT,
    is_compulsory BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assessment_844_student ON assessment_844_system(student_id);

CREATE TABLE IF NOT EXISTS assessment_british_curriculum (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
    term_id INT REFERENCES terms(id) ON DELETE SET NULL,
    subject VARCHAR(100) NOT NULL,
    key_stage VARCHAR(50),
    attainment_grade VARCHAR(10),
    effort_grade VARCHAR(10),
    predicted_grade VARCHAR(10),
    mock_result VARCHAR(10),
    checkpoint_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_british_assessment_student ON assessment_british_curriculum(student_id);

CREATE TABLE IF NOT EXISTS assessment_american_curriculum (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
    course_id INT REFERENCES courses(id) ON DELETE SET NULL,
    subject VARCHAR(100) NOT NULL,
    grade_level VARCHAR(50),
    letter_grade VARCHAR(5),
    gpa_points DECIMAL(3,2),
    credits_earned DECIMAL(3,1),
    map_rit_score INT,
    map_percentile INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_american_assessment_student ON assessment_american_curriculum(student_id);

CREATE TABLE IF NOT EXISTS assessment_ib (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
    subject VARCHAR(100) NOT NULL,
    programme VARCHAR(20) DEFAULT 'DP',
    criterion_a INT,
    criterion_b INT,
    criterion_c INT,
    criterion_d INT,
    total_criteria_score INT,
    final_grade INT CHECK (final_grade BETWEEN 1 AND 7),
    internal_assessment_score DECIMAL(5,2),
    external_assessment_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ib_assessment_student ON assessment_ib(student_id);

CREATE TABLE IF NOT EXISTS ib_cas_portfolio (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    activity_title VARCHAR(255) NOT NULL,
    activity_type VARCHAR(50) CHECK (activity_type IN ('Creativity', 'Activity', 'Service')),
    start_date DATE,
    end_date DATE,
    hours_logged DECIMAL(5,2),
    description TEXT,
    reflection TEXT,
    evidence_url TEXT,
    supervisor_id INT REFERENCES users(id) ON DELETE SET NULL,
    completion_status VARCHAR(20) DEFAULT 'ongoing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ib_cas_school ON ib_cas_portfolio(school_id);

CREATE TABLE IF NOT EXISTS merit_lists (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id INT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    term_id INT REFERENCES terms(id) ON DELETE SET NULL,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    grade_level VARCHAR(50),
    stream VARCHAR(50),
    position INT,
    mean_score DECIMAL(5,2),
    total_marks DECIMAL(10,2),
    total_students_in_class INT,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(academic_year_id, term_id, grade_level, stream, student_id)
);

CREATE INDEX idx_merit_lists_school ON merit_lists(school_id);

-- ============================================
-- DISCIPLINE & BEHAVIOR
-- ============================================

-- Discipline Records
CREATE TABLE IF NOT EXISTS discipline (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    reported_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    incident_type VARCHAR(20) NOT NULL CHECK (incident_type IN ('tardiness', 'absence', 'misconduct', 'bullying', 'academic', 'violence', 'other')),
    severity VARCHAR(20) DEFAULT 'moderate' CHECK (severity IN ('minor', 'moderate', 'major', 'critical')),
    
    date DATE NOT NULL,
    time TIME,
    location VARCHAR(255),
    description TEXT NOT NULL,
    action_taken TEXT,
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'escalated', 'closed')),
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    
    parent_notified BOOLEAN DEFAULT FALSE,
    parent_notified_at TIMESTAMP,
    parent_signature TEXT,
    
    witnesses TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_discipline_student ON discipline(student_id);
CREATE INDEX idx_discipline_date ON discipline(date);
CREATE INDEX idx_discipline_status ON discipline(status);

-- ============================================
-- FEE MANAGEMENT
-- ============================================

-- Fee Structures
CREATE TABLE IF NOT EXISTS fee_structures (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(10,2) NOT NULL,
    
    fee_type VARCHAR(20) DEFAULT 'tuition' CHECK (fee_type IN ('tuition', 'admission', 'exam', 'transport', 'library', 'lab', 'sports', 'uniform', 'other')),
    frequency VARCHAR(20) DEFAULT 'monthly' CHECK (frequency IN ('one-time', 'monthly', 'quarterly', 'semester', 'annual')),
    
    -- Applicability
    applicable_to VARCHAR(50),
    academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
    
    is_mandatory BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    
    due_day INT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fee_structure_school ON fee_structures(school_id);
CREATE INDEX idx_fee_structure_active ON fee_structures(is_active);

-- Student Fees
CREATE TABLE IF NOT EXISTS student_fees (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_structure_id INT REFERENCES fee_structures(id) ON DELETE SET NULL,
    academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
    term_id INT REFERENCES terms(id) ON DELETE SET NULL,
    
    description VARCHAR(255),
    amount_due DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0.00,
    amount_discount DECIMAL(10,2) DEFAULT 0.00,
    
    due_date DATE NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue', 'waived')),
    
    remarks TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_student_fee_student ON student_fees(student_id);
CREATE INDEX idx_student_fee_status ON student_fees(payment_status);
CREATE INDEX idx_student_fee_due_date ON student_fees(due_date);

-- Fee Payments
CREATE TABLE IF NOT EXISTS fee_payments (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    student_fee_id INT REFERENCES student_fees(id) ON DELETE SET NULL,
    
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'mobile_money', 'mpesa', 'cheque', 'other')),
    payment_date DATE NOT NULL,
    
    transaction_id VARCHAR(255),
    receipt_number VARCHAR(100),
    
    remarks TEXT,
    received_by INT REFERENCES users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(school_id, receipt_number)
);

CREATE INDEX idx_payment_student ON fee_payments(student_id);
CREATE INDEX idx_payment_date ON fee_payments(payment_date);
CREATE INDEX idx_payment_receipt ON fee_payments(receipt_number);

CREATE TABLE IF NOT EXISTS mpesa_transactions (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    mpesa_code VARCHAR(50) UNIQUE,
    phone_number VARCHAR(20),
    transaction_type VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending',
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mpesa_school ON mpesa_transactions(school_id);

CREATE TABLE IF NOT EXISTS payment_transactions (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_fee_id INT NOT NULL REFERENCES student_fees(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'initiated',
    amount DECIMAL(10,2) NOT NULL,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_transaction_school ON payment_transactions(school_id);
CREATE INDEX idx_payment_transaction_fee ON payment_transactions(student_fee_id);
CREATE INDEX idx_payment_transaction_status ON payment_transactions(status);
CREATE INDEX idx_payment_transaction_provider ON payment_transactions(provider);

CREATE TABLE IF NOT EXISTS staff_records (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    hire_date DATE,
    termination_date DATE,
    salary DECIMAL(10,2),
    salary_currency VARCHAR(10) DEFAULT 'KES',
    employment_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    staff_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month INT NOT NULL,
    year INT NOT NULL,
    gross_salary DECIMAL(10,2),
    deductions JSONB,
    tax DECIMAL(10,2),
    net_salary DECIMAL(10,2),
    payment_status VARCHAR(50) DEFAULT 'pending',
    payment_date DATE,
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(school_id, staff_id, month, year)
);

CREATE TABLE IF NOT EXISTS staff_deductions (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    staff_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    deduction_type VARCHAR(50) NOT NULL,
    description TEXT,
    effective_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payroll_school ON payroll(school_id);
CREATE INDEX idx_payroll_staff ON payroll(staff_id);
CREATE INDEX idx_payroll_month_year ON payroll(month, year);
CREATE INDEX idx_staff_deductions_school ON staff_deductions(school_id);
CREATE INDEX idx_staff_deductions_staff ON staff_deductions(staff_id);

-- ============================================
-- BOARDING & TRANSPORT EXTENSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS boarding_houses (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    house_name VARCHAR(255) NOT NULL,
    house_code VARCHAR(50),
    house_master_id INT REFERENCES users(id) ON DELETE SET NULL,
    deputy_master_id INT REFERENCES users(id) ON DELETE SET NULL,
    capacity INT,
    current_occupancy INT DEFAULT 0,
    gender_type VARCHAR(20) CHECK (gender_type IN ('boys', 'girls', 'mixed')),
    floor_count INT,
    facilities TEXT,
    fee_amount DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'full', 'maintenance')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, house_code)
);

CREATE INDEX idx_boarding_houses_school ON boarding_houses(school_id);

CREATE TABLE IF NOT EXISTS boarding_rooms (
    id SERIAL PRIMARY KEY,
    boarding_house_id INT NOT NULL REFERENCES boarding_houses(id) ON DELETE CASCADE,
    room_number VARCHAR(50) NOT NULL,
    floor INT,
    room_type VARCHAR(20) CHECK (room_type IN ('single', 'double', 'triple', 'dormitory')),
    bed_capacity INT,
    available_beds INT,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(boarding_house_id, room_number)
);

CREATE INDEX idx_boarding_rooms_house ON boarding_rooms(boarding_house_id);

CREATE TABLE IF NOT EXISTS boarding_enrollments (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    boarding_house_id INT NOT NULL REFERENCES boarding_houses(id) ON DELETE CASCADE,
    room_id INT REFERENCES boarding_rooms(id) ON DELETE SET NULL,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    check_in_date DATE,
    check_out_date DATE,
    academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid', 'partial', 'pending')),
    amount_due DECIMAL(10,2),
    amount_paid DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'completed')),
    emergency_contact_phone VARCHAR(50),
    parent_signature TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, academic_year_id)
);

CREATE INDEX idx_boarding_enrollments_school ON boarding_enrollments(school_id);

CREATE TABLE IF NOT EXISTS boarding_assignments (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    dormitory_id INT REFERENCES boarding_houses(id) ON DELETE SET NULL,
    bed_number VARCHAR(50),
    assignment_status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, student_id)
);

CREATE INDEX idx_boarding_school ON boarding_assignments(school_id);

CREATE TABLE IF NOT EXISTS boarding_exeat_requests (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    approval_notes TEXT,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exeat_school ON boarding_exeat_requests(school_id);

CREATE TABLE IF NOT EXISTS kitchen_inventory_logs (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20),
    usage_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kitchen_school ON kitchen_inventory_logs(school_id);

CREATE TABLE IF NOT EXISTS textbook_issuance_logs (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    book_id VARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    issue_date DATE DEFAULT CURRENT_DATE,
    return_date DATE,
    status VARCHAR(20) DEFAULT 'issued',
    loss_fee DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_textbook_school ON textbook_issuance_logs(school_id);

CREATE TABLE IF NOT EXISTS transport_routes (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    route_name VARCHAR(255) NOT NULL,
    route_code VARCHAR(50),
    description TEXT,
    start_location VARCHAR(255),
    end_location VARCHAR(255),
    pickup_time TIME,
    dropoff_time TIME,
    vehicle_type VARCHAR(50),
    capacity INT,
    driver_id INT REFERENCES users(id) ON DELETE SET NULL,
    fare_amount DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, route_code)
);

CREATE INDEX idx_route_school ON transport_routes(school_id);

CREATE TABLE IF NOT EXISTS transport_enrollments (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    route_id INT NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid', 'partial', 'pending')),
    amount_due DECIMAL(10,2),
    amount_paid DECIMAL(10,2) DEFAULT 0,
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'completed')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, route_id)
);

CREATE INDEX idx_transport_enrollments_school ON transport_enrollments(school_id);

CREATE TABLE IF NOT EXISTS transport_assignments (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    route_id INT NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
    pickup_point VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, student_id)
);

CREATE INDEX idx_transport_school ON transport_assignments(school_id);

CREATE TABLE IF NOT EXISTS transport_attendance (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    route_id INT REFERENCES transport_routes(id) ON DELETE SET NULL,
    attendance_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'present',
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, student_id, attendance_date)
);

CREATE INDEX idx_transport_attendance_school ON transport_attendance(school_id);

-- ============================================
-- COMMUNICATIONS & MESSAGING
-- ============================================

CREATE TABLE IF NOT EXISTS sms_campaigns (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    recipient_group VARCHAR(50),
    message TEXT NOT NULL,
    gateway VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMP,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_campaign_school ON sms_campaigns(school_id);

-- Messages/Announcements
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('all', 'students', 'parents', 'teachers', 'staff', 'grade', 'individual')),
    recipient_id INT REFERENCES users(id) ON DELETE CASCADE,
    recipient_grade VARCHAR(50),
    
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'message' CHECK (message_type IN ('announcement', 'notice', 'alert', 'message')),
    
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    send_email BOOLEAN DEFAULT FALSE,
    send_sms BOOLEAN DEFAULT FALSE,
    
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_message_school ON messages(school_id);
CREATE INDEX idx_message_recipient ON messages(recipient_type, recipient_id);
CREATE INDEX idx_message_sent_at ON messages(sent_at);

-- Message Recipients
CREATE TABLE IF NOT EXISTS message_recipients (
    id SERIAL PRIMARY KEY,
    message_id INT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(message_id, user_id)
);

CREATE INDEX idx_recipient_user ON message_recipients(user_id);
CREATE INDEX idx_recipient_read ON message_recipients(is_read);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    school_id INT REFERENCES schools(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(20) DEFAULT 'info' CHECK (notification_type IN ('info', 'success', 'warning', 'error')),
    
    link_url VARCHAR(255),
    
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_user ON notifications(user_id);
CREATE INDEX idx_notification_read ON notifications(is_read);
CREATE INDEX idx_notification_created ON notifications(created_at);

-- ============================================
-- TIMETABLE MANAGEMENT
-- ============================================

-- Timetable Periods
CREATE TABLE IF NOT EXISTS timetable_periods (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    period_number INT,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    is_break BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_period_school ON timetable_periods(school_id);

-- Timetable Entries
CREATE TABLE IF NOT EXISTS timetable_entries (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
    term_id INT REFERENCES terms(id) ON DELETE SET NULL,
    
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id INT REFERENCES users(id) ON DELETE SET NULL,
    
    day_of_week VARCHAR(20) NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
    period_id INT NOT NULL REFERENCES timetable_periods(id) ON DELETE CASCADE,
    
    grade VARCHAR(50),
    class_section VARCHAR(10),
    classroom VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_timetable_school ON timetable_entries(school_id);
CREATE INDEX idx_timetable_day_period ON timetable_entries(day_of_week, period_id);
CREATE INDEX idx_timetable_teacher ON timetable_entries(teacher_id);
CREATE INDEX idx_timetable_grade_section ON timetable_entries(grade, class_section);

-- ============================================
-- LEAVE MANAGEMENT
-- ============================================

-- Leave Types
CREATE TABLE IF NOT EXISTS leave_types (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    max_days_per_year INT,
    requires_approval BOOLEAN DEFAULT TRUE,
    
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leave_type_school ON leave_types(school_id);

-- Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_type_id INT NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INT NOT NULL,
    
    reason TEXT NOT NULL,
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    
    approved_by INT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leave_request_user ON leave_requests(user_id);
CREATE INDEX idx_leave_request_status ON leave_requests(status);
CREATE INDEX idx_leave_request_dates ON leave_requests(start_date, end_date);

-- ============================================
-- AUDIT & ACTIVITY LOGS
-- ============================================

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    school_id INT REFERENCES schools(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    metadata JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_school ON activity_logs(school_id);
CREATE INDEX idx_activity_user ON activity_logs(user_id);
CREATE INDEX idx_activity_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_created ON activity_logs(created_at);

-- ============================================
-- SEED DATA
-- ============================================

-- Insert default subscription plans (with conflict handling)
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_annual, student_limit, staff_limit, trial_duration_days, include_parent_portal, include_student_portal, include_messaging, include_finance, include_advanced_reports, include_leave_management, include_ai_analytics, is_trial, is_active) VALUES
('Trial Plan', 'trial', 'Free 14-day trial with limited features', 0.00, 0.00, 50, 10, 14, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE),
('Basic Plan', 'basic', 'Perfect for small schools', 49.99, 499.99, 100, 20, 0, TRUE, TRUE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, TRUE),
('Professional Plan', 'pro', 'Advanced features for growing schools', 99.99, 999.99, 500, 50, 0, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, FALSE, TRUE),
('Enterprise Plan', 'enterprise', 'Unlimited features for large institutions', 199.99, 1999.99, NULL, NULL, 0, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE)
ON CONFLICT (slug) DO NOTHING;
