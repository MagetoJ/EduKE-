# EduKE Backend Rebuild Plan - Multi-Tenant School Management System

## Table of Contents
1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [API Architecture](#api-architecture)
4. [Authentication & Security](#authentication--security)
5. [Multi-Tenancy Implementation](#multi-tenancy-implementation)
6. [API Endpoints](#api-endpoints)
7. [Implementation Steps](#implementation-steps)
8. [Technology Stack](#technology-stack)
9. [Deployment Strategy](#deployment-strategy)

---

## 1. System Overview

### Architecture Type
- **Multi-tenant SaaS Platform**
- **Tenancy Model**: Shared Database with Tenant Isolation (school_id)
- **Backend Stack**: Node.js + Express.js + TypeScript
- **Database**: PostgreSQL (recommended for production) or MySQL

### User Roles & Access Levels
1. **Super Admin** - Platform owner, manages all schools
2. **School Admin** - Manages individual school
3. **Teacher** - Manages classes, students, grades
4. **Parent** - Views child's information
5. **Student** - Views own information

### Core Features Identified
- Authentication & Authorization (JWT-based)
- School Management (Multi-tenant)
- User Management (Staff, Teachers, Parents, Students)
- Student Management & Enrollment
- Academic Year Management (with auto-promotion)
- Courses & Curriculum
- Assignments & Submissions
- Examinations & Grading
- Attendance Tracking
- Fee Management & Payment Tracking
- Performance & Progress Reports
- Discipline Records
- Parent Portal (linked student access)
- Communications/Messaging
- Leave Management
- Subscription/Plan Management
- Reports & Analytics
- Timetable Management

---

## 2. Database Schema

### 2.1 Global Tables (No school_id)

```sql
-- Subscription Plans
CREATE TABLE subscription_plans (
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_plan_slug (slug)
);
```

### 2.2 School (Tenant) Tables

```sql
-- Schools (Tenants)
CREATE TABLE schools (
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
    curriculum ENUM('cbc', '844', 'british', 'american', 'ib') DEFAULT 'cbc',
    level VARCHAR(100), -- 'Primary', 'Secondary', 'High School'
    principal VARCHAR(255),
    logo_url TEXT,
    primary_color VARCHAR(7), -- Hex color for branding
    accent_color VARCHAR(7),
    
    -- Grade levels stored as JSON array
    grade_levels JSON, -- ["Grade 1", "Grade 2", ...]
    
    -- Timestamps
    registration_date DATE DEFAULT CURRENT_DATE,
    status ENUM('active', 'suspended', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_school_slug (slug),
    INDEX idx_school_status (status),
    INDEX idx_school_curriculum (curriculum)
);

-- School Subscriptions
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    plan_id INT NOT NULL,
    
    status ENUM('active', 'expired', 'cancelled', 'suspended', 'trial') DEFAULT 'trial',
    start_date DATE NOT NULL,
    end_date DATE,
    trial_ends_at TIMESTAMP,
    
    -- Billing
    next_billing_date DATE,
    billing_cycle ENUM('monthly', 'annual'),
    amount DECIMAL(10,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
    INDEX idx_subscription_school (school_id),
    INDEX idx_subscription_status (status),
    INDEX idx_subscription_expiry (end_date)
);
```

### 2.3 User Management

```sql
-- Users (Staff, Teachers, Parents, Students with portal access, Admins)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    school_id INT, -- NULL for super_admins
    
    -- Authentication
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    name VARCHAR(255), -- Full name
    phone VARCHAR(50),
    date_of_birth DATE,
    gender ENUM('male', 'female', 'other'),
    address TEXT,
    avatar_url TEXT,
    
    -- Role & Access
    role ENUM('super_admin', 'admin', 'teacher', 'parent', 'student') NOT NULL,
    department VARCHAR(100), -- For staff/teachers
    subject VARCHAR(255), -- For teachers (can be JSON array)
    class_assigned VARCHAR(50), -- For teachers
    employee_id VARCHAR(50), -- For staff
    
    -- Status
    status ENUM('active', 'inactive', 'suspended', 'archived') DEFAULT 'active',
    is_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP,
    last_login_at TIMESTAMP,
    
    -- Employment info (for staff/teachers)
    hire_date DATE,
    termination_date DATE,
    salary DECIMAL(10,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    INDEX idx_user_email (email),
    INDEX idx_user_school_role (school_id, role),
    INDEX idx_user_status (status)
);

-- Password Reset Tokens
CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token_hash (token_hash),
    INDEX idx_token_expiry (expires_at)
);

-- Email Verification Tokens
CREATE TABLE email_verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_verification_token (token_hash)
);

-- Refresh Tokens (JWT)
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_refresh_token (token_hash),
    INDEX idx_refresh_expiry (expires_at)
);
```

### 2.4 Student Management

```sql
-- Students
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    user_id INT, -- Links to users table if student has portal access
    parent_id INT, -- Primary parent/guardian user_id
    
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    date_of_birth DATE,
    gender ENUM('male', 'female', 'other'),
    address TEXT,
    avatar_url TEXT,
    
    -- Identification
    student_id_number VARCHAR(50), -- School-specific ID
    national_id VARCHAR(50), -- Birth certificate or ID number
    
    -- Academic Information
    grade VARCHAR(50) NOT NULL, -- 'Grade 10', 'Form 2', etc.
    class_section VARCHAR(10), -- 'A', 'B', 'C'
    enrollment_date DATE,
    graduation_date DATE,
    
    -- Status
    status ENUM('active', 'inactive', 'transferred', 'graduated', 'retained', 'archived') DEFAULT 'active',
    
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_school_student_id (school_id, student_id_number),
    INDEX idx_student_school (school_id),
    INDEX idx_student_grade (grade),
    INDEX idx_student_status (status),
    INDEX idx_student_parent (parent_id)
);

-- Parent-Student Relations (for multiple children/guardians)
CREATE TABLE parent_student_relations (
    id SERIAL PRIMARY KEY,
    parent_id INT NOT NULL,
    student_id INT NOT NULL,
    relation_type ENUM('father', 'mother', 'guardian', 'other') DEFAULT 'guardian',
    is_primary_contact BOOLEAN DEFAULT FALSE,
    is_financial_responsible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE KEY unique_parent_student (parent_id, student_id),
    INDEX idx_parent_relations (parent_id),
    INDEX idx_student_relations (student_id)
);
```

### 2.5 Academic Year & Curriculum

```sql
-- Academic Years
CREATE TABLE academic_years (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    
    name VARCHAR(100), -- e.g., "2024/2025"
    start_date DATE NOT NULL,
    end_date DATE,
    status ENUM('active', 'completed', 'upcoming') DEFAULT 'upcoming',
    
    -- Promotion settings
    promotion_threshold DECIMAL(5,2) DEFAULT 50.00, -- Minimum average for promotion
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    INDEX idx_academic_year_school (school_id),
    INDEX idx_academic_year_status (status)
);

-- Terms/Semesters
CREATE TABLE terms (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    academic_year_id INT NOT NULL,
    
    name VARCHAR(50), -- 'Term 1', 'Semester 1', 'Quarter 1'
    term_number INT, -- 1, 2, 3
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('active', 'completed', 'upcoming') DEFAULT 'upcoming',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
    INDEX idx_term_school (school_id),
    INDEX idx_term_year (academic_year_id)
);

-- Courses/Subjects
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    teacher_id INT, -- Primary teacher
    academic_year_id INT,
    
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    grade VARCHAR(50), -- Applicable grade level
    subject_area VARCHAR(100), -- 'Mathematics', 'Science', etc.
    
    -- Schedule
    schedule TEXT, -- 'Mon, Wed, Fri - 9:00 AM' or JSON format
    classroom VARCHAR(50),
    credits INT,
    
    -- Settings
    max_students INT,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    UNIQUE KEY unique_school_course_code (school_id, code),
    INDEX idx_course_school (school_id),
    INDEX idx_course_teacher (teacher_id),
    INDEX idx_course_grade (grade)
);

-- Course Enrollments
CREATE TABLE course_enrollments (
    id SERIAL PRIMARY KEY,
    course_id INT NOT NULL,
    student_id INT NOT NULL,
    academic_year_id INT,
    term_id INT,
    
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status ENUM('enrolled', 'completed', 'dropped', 'failed') DEFAULT 'enrolled',
    final_grade DECIMAL(5,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE SET NULL,
    UNIQUE KEY unique_course_student_term (course_id, student_id, term_id),
    INDEX idx_enrollment_course (course_id),
    INDEX idx_enrollment_student (student_id)
);

-- Course Resources
CREATE TABLE course_resources (
    id SERIAL PRIMARY KEY,
    course_id INT NOT NULL,
    
    title VARCHAR(255) NOT NULL,
    description TEXT,
    resource_type ENUM('document', 'video', 'link', 'file', 'other') DEFAULT 'document',
    url TEXT,
    file_path TEXT,
    file_size INT, -- in bytes
    mime_type VARCHAR(100),
    
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_resource_course (course_id)
);
```

### 2.6 Assignments & Submissions

```sql
-- Assignments
CREATE TABLE assignments (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    course_id INT NOT NULL,
    teacher_id INT NOT NULL,
    academic_year_id INT,
    term_id INT,
    
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    
    -- Assignment Details
    assignment_type ENUM('homework', 'project', 'quiz', 'lab', 'essay', 'other') DEFAULT 'homework',
    total_marks INT DEFAULT 100,
    weightage DECIMAL(5,2), -- Percentage of total grade
    
    -- Dates
    assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP NOT NULL,
    late_submission_allowed BOOLEAN DEFAULT TRUE,
    late_penalty_percent DECIMAL(5,2) DEFAULT 10.00,
    
    -- Attachments
    attachment_url TEXT,
    
    status ENUM('draft', 'published', 'closed') DEFAULT 'published',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE SET NULL,
    INDEX idx_assignment_school (school_id),
    INDEX idx_assignment_course (course_id),
    INDEX idx_assignment_due_date (due_date)
);

-- Assignment Submissions
CREATE TABLE assignment_submissions (
    id SERIAL PRIMARY KEY,
    assignment_id INT NOT NULL,
    student_id INT NOT NULL,
    
    submission_text TEXT,
    attachment_url TEXT,
    submitted_at TIMESTAMP,
    
    -- Grading
    grade DECIMAL(5,2),
    max_grade INT,
    graded_by INT, -- teacher_id
    graded_at TIMESTAMP,
    feedback TEXT,
    
    status ENUM('pending', 'submitted', 'late', 'graded', 'returned') DEFAULT 'pending',
    is_late BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_assignment_student (assignment_id, student_id),
    INDEX idx_submission_assignment (assignment_id),
    INDEX idx_submission_student (student_id),
    INDEX idx_submission_status (status)
);
```

### 2.7 Examinations

```sql
-- Exams
CREATE TABLE exams (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    course_id INT,
    academic_year_id INT,
    term_id INT,
    
    title VARCHAR(255) NOT NULL,
    exam_type ENUM('midterm', 'final', 'quiz', 'test', 'practical', 'cat') DEFAULT 'test',
    description TEXT,
    
    -- Exam Details
    total_marks INT DEFAULT 100,
    passing_marks INT DEFAULT 40,
    duration_minutes INT, -- Exam duration
    
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
    
    status ENUM('scheduled', 'ongoing', 'completed', 'cancelled') DEFAULT 'scheduled',
    
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_exam_school (school_id),
    INDEX idx_exam_course (course_id),
    INDEX idx_exam_date (exam_date)
);

-- Exam Results
CREATE TABLE exam_results (
    id SERIAL PRIMARY KEY,
    exam_id INT NOT NULL,
    student_id INT NOT NULL,
    
    marks_obtained DECIMAL(5,2) NOT NULL,
    total_marks INT NOT NULL,
    percentage DECIMAL(5,2),
    grade VARCHAR(5), -- 'A', 'B+', etc.
    
    remarks TEXT,
    graded_by INT,
    graded_at TIMESTAMP,
    
    status ENUM('absent', 'pending', 'graded', 'published') DEFAULT 'pending',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_exam_student (exam_id, student_id),
    INDEX idx_result_exam (exam_id),
    INDEX idx_result_student (student_id)
);
```

### 2.8 Attendance

```sql
-- Attendance Records
CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    student_id INT NOT NULL,
    course_id INT, -- NULL for general attendance
    
    date DATE NOT NULL,
    status ENUM('present', 'absent', 'late', 'excused') NOT NULL,
    
    check_in_time TIME,
    check_out_time TIME,
    remarks TEXT,
    
    recorded_by INT, -- teacher_id
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_student_date_course (student_id, date, course_id),
    INDEX idx_attendance_school (school_id),
    INDEX idx_attendance_student (student_id),
    INDEX idx_attendance_date (date)
);
```

### 2.9 Performance & Grading

```sql
-- Student Performance Records
CREATE TABLE performance (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    student_id INT NOT NULL,
    course_id INT,
    academic_year_id INT,
    term_id INT,
    
    subject VARCHAR(100),
    grade DECIMAL(5,2) NOT NULL,
    max_grade INT DEFAULT 100,
    
    assessment_type ENUM('assignment', 'exam', 'quiz', 'project', 'continuous', 'other'),
    remarks TEXT,
    
    recorded_by INT, -- teacher_id
    date_recorded DATE DEFAULT CURRENT_DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE SET NULL,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_performance_student (student_id),
    INDEX idx_performance_course (course_id),
    INDEX idx_performance_term (term_id)
);

-- Report Cards
CREATE TABLE report_cards (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    student_id INT NOT NULL,
    academic_year_id INT NOT NULL,
    term_id INT,
    
    overall_grade DECIMAL(5,2),
    overall_percentage DECIMAL(5,2),
    rank_in_class INT,
    total_students INT,
    
    attendance_percentage DECIMAL(5,2),
    conduct_grade VARCHAR(5),
    teacher_remarks TEXT,
    principal_remarks TEXT,
    
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    generated_by INT,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
    FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE SET NULL,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_report_student_term (student_id, academic_year_id, term_id),
    INDEX idx_report_student (student_id),
    INDEX idx_report_year_term (academic_year_id, term_id)
);
```

### 2.10 Discipline & Behavior

```sql
-- Discipline Records
CREATE TABLE discipline (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    student_id INT NOT NULL,
    reported_by INT NOT NULL, -- teacher/admin user_id
    
    incident_type ENUM('tardiness', 'absence', 'misconduct', 'bullying', 'academic', 'violence', 'other') NOT NULL,
    severity ENUM('minor', 'moderate', 'major', 'critical') DEFAULT 'moderate',
    
    date DATE NOT NULL,
    time TIME,
    location VARCHAR(255),
    description TEXT NOT NULL,
    action_taken TEXT,
    
    status ENUM('pending', 'resolved', 'escalated', 'closed') DEFAULT 'pending',
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    
    parent_notified BOOLEAN DEFAULT FALSE,
    parent_notified_at TIMESTAMP,
    parent_signature TEXT,
    
    witnesses TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_discipline_student (student_id),
    INDEX idx_discipline_date (date),
    INDEX idx_discipline_status (status)
);
```

### 2.11 Fee Management

```sql
-- Fee Structures
CREATE TABLE fee_structures (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(10,2) NOT NULL,
    
    fee_type ENUM('tuition', 'admission', 'exam', 'transport', 'library', 'lab', 'sports', 'uniform', 'other') DEFAULT 'tuition',
    frequency ENUM('one-time', 'monthly', 'quarterly', 'semester', 'annual') DEFAULT 'monthly',
    
    -- Applicability
    applicable_to VARCHAR(50), -- 'All' or specific grade like 'Grade 10'
    academic_year_id INT,
    
    is_mandatory BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    
    due_day INT, -- Day of month when due (1-31)
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    INDEX idx_fee_structure_school (school_id),
    INDEX idx_fee_structure_active (is_active)
);

-- Student Fees (Individual fee assignments)
CREATE TABLE student_fees (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    student_id INT NOT NULL,
    fee_structure_id INT,
    academic_year_id INT,
    term_id INT,
    
    description VARCHAR(255),
    amount_due DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0.00,
    amount_discount DECIMAL(10,2) DEFAULT 0.00,
    
    due_date DATE NOT NULL,
    payment_status ENUM('pending', 'partial', 'paid', 'overdue', 'waived') DEFAULT 'pending',
    
    remarks TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (fee_structure_id) REFERENCES fee_structures(id) ON DELETE SET NULL,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE SET NULL,
    INDEX idx_student_fee_student (student_id),
    INDEX idx_student_fee_status (payment_status),
    INDEX idx_student_fee_due_date (due_date)
);

-- Fee Payments
CREATE TABLE fee_payments (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    student_id INT NOT NULL,
    student_fee_id INT,
    
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('cash', 'card', 'bank_transfer', 'mobile_money', 'mpesa', 'cheque', 'other') DEFAULT 'cash',
    payment_date DATE NOT NULL,
    
    transaction_id VARCHAR(255),
    receipt_number VARCHAR(100),
    
    remarks TEXT,
    received_by INT, -- staff/admin user_id
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE SET NULL,
    FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_receipt_number (school_id, receipt_number),
    INDEX idx_payment_student (student_id),
    INDEX idx_payment_date (payment_date),
    INDEX idx_payment_receipt (receipt_number)
);
```

### 2.12 Communications & Messaging

```sql
-- Messages/Announcements
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    
    sender_id INT NOT NULL,
    recipient_type ENUM('all', 'students', 'parents', 'teachers', 'staff', 'grade', 'individual') NOT NULL,
    recipient_id INT, -- For individual messages
    recipient_grade VARCHAR(50), -- For grade-specific
    
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    message_type ENUM('announcement', 'notice', 'alert', 'message') DEFAULT 'message',
    
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    
    send_email BOOLEAN DEFAULT FALSE,
    send_sms BOOLEAN DEFAULT FALSE,
    
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_message_school (school_id),
    INDEX idx_message_recipient (recipient_type, recipient_id),
    INDEX idx_message_sent_at (sent_at)
);

-- Message Recipients (for tracking read status)
CREATE TABLE message_recipients (
    id SERIAL PRIMARY KEY,
    message_id INT NOT NULL,
    user_id INT NOT NULL,
    
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_message_user (message_id, user_id),
    INDEX idx_recipient_user (user_id),
    INDEX idx_recipient_read (is_read)
);

-- Notifications
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    school_id INT,
    user_id INT NOT NULL,
    
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
    
    link_url VARCHAR(255),
    
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notification_user (user_id),
    INDEX idx_notification_read (is_read),
    INDEX idx_notification_created (created_at)
);
```

### 2.13 Timetable Management

```sql
-- Timetable Periods
CREATE TABLE timetable_periods (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    
    name VARCHAR(100) NOT NULL, -- 'Period 1', 'Break', 'Lunch'
    period_number INT,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    is_break BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    INDEX idx_period_school (school_id)
);

-- Timetable Entries
CREATE TABLE timetable_entries (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    academic_year_id INT,
    term_id INT,
    
    course_id INT NOT NULL,
    teacher_id INT,
    
    day_of_week ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') NOT NULL,
    period_id INT NOT NULL,
    
    grade VARCHAR(50),
    class_section VARCHAR(10),
    classroom VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE SET NULL,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (period_id) REFERENCES timetable_periods(id) ON DELETE CASCADE,
    INDEX idx_timetable_school (school_id),
    INDEX idx_timetable_day_period (day_of_week, period_id),
    INDEX idx_timetable_teacher (teacher_id),
    INDEX idx_timetable_grade_section (grade, class_section)
);
```

### 2.14 Leave Management

```sql
-- Leave Types
CREATE TABLE leave_types (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    max_days_per_year INT,
    requires_approval BOOLEAN DEFAULT TRUE,
    
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    INDEX idx_leave_type_school (school_id)
);

-- Leave Requests
CREATE TABLE leave_requests (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL,
    user_id INT NOT NULL, -- Staff/Teacher requesting leave
    leave_type_id INT NOT NULL,
    
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INT NOT NULL,
    
    reason TEXT NOT NULL,
    
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    
    approved_by INT,
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_leave_request_user (user_id),
    INDEX idx_leave_request_status (status),
    INDEX idx_leave_request_dates (start_date, end_date)
);
```

### 2.15 Audit & Activity Logs

```sql
-- Activity Logs (for audit trail)
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    school_id INT,
    user_id INT,
    
    action VARCHAR(100) NOT NULL, -- 'create', 'update', 'delete', 'login', etc.
    entity_type VARCHAR(50), -- 'student', 'user', 'course', etc.
    entity_id INT,
    
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    metadata JSON, -- Additional context data
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_activity_school (school_id),
    INDEX idx_activity_user (user_id),
    INDEX idx_activity_entity (entity_type, entity_id),
    INDEX idx_activity_created (created_at)
);
```

---

## 3. API Architecture

### 3.1 RESTful API Structure

```
/api
  /auth
    POST   /register-school          - Register new school
    POST   /login                     - User login
    POST   /logout                    - User logout
    POST   /refresh-token             - Refresh access token
    POST   /forgot-password           - Request password reset
    POST   /reset-password            - Reset password with token
    POST   /verify-email              - Verify email address
    POST   /resend-verification       - Resend verification email
  
  /schools
    GET    /                          - List all schools (super_admin)
    POST   /                          - Create school (super_admin)
    GET    /:id                       - Get school details
    PUT    /:id                       - Update school
    DELETE /:id                       - Delete school (super_admin)
    GET    /:id/subscription          - Get school subscription
    PUT    /:id/subscription          - Update school subscription
    GET    /:id/analytics             - Get school analytics (super_admin)
  
  /school/settings
    GET    /                          - Get current school settings
    PUT    /                          - Update school settings
  
  /users
    GET    /                          - List users (filtered by school)
    POST   /                          - Create user
    GET    /:id                       - Get user details
    PUT    /:id                       - Update user
    DELETE /:id                       - Delete/archive user
    GET    /me                        - Get current user profile
    PUT    /me                        - Update current user profile
    PUT    /me/password               - Change password
  
  /staff
    GET    /                          - List staff members
    POST   /                          - Add staff member
    GET    /:id                       - Get staff details
    PUT    /:id                       - Update staff member
    DELETE /:id                       - Remove staff member
  
  /students
    GET    /                          - List students
    POST   /                          - Enroll student
    GET    /:id                       - Get student details
    PUT    /:id                       - Update student
    DELETE /:id                       - Archive student
    GET    /:id/performance           - Get student performance
    GET    /:id/attendance            - Get student attendance
    GET    /:id/fees                  - Get student fees
    GET    /:id/discipline            - Get discipline records
    GET    /:id/report-card           - Get report card
  
  /parents
    GET    /                          - List parents
    POST   /                          - Add parent
    GET    /:id                       - Get parent details
    GET    /:id/children              - Get parent's children
    POST   /link-student              - Link parent to student
  
  /academic-years
    GET    /                          - List academic years
    POST   /                          - Create academic year
    POST   /start                     - Start academic year
    POST   /end                       - End academic year (with promotion)
    GET    /:id                       - Get academic year details
    PUT    /:id                       - Update academic year
  
  /terms
    GET    /                          - List terms
    POST   /                          - Create term
    GET    /:id                       - Get term details
    PUT    /:id                       - Update term
  
  /courses
    GET    /                          - List courses
    POST   /                          - Create course
    GET    /:id                       - Get course details
    PUT    /:id                       - Update course
    DELETE /:id                       - Delete course
    GET    /:id/students              - Get enrolled students
    POST   /:id/enroll                - Enroll student in course
    GET    /:id/resources             - Get course resources
    POST   /:id/resources             - Add course resource
    DELETE /:id/resources/:resourceId - Delete resource
  
  /assignments
    GET    /                          - List assignments
    POST   /                          - Create assignment
    GET    /:id                       - Get assignment details
    PUT    /:id                       - Update assignment
    DELETE /:id                       - Delete assignment
    GET    /:id/submissions           - Get all submissions
    POST   /:id/submit                - Submit assignment (student)
    PUT    /:id/submissions/:subId    - Grade submission (teacher)
  
  /exams
    GET    /                          - List exams
    POST   /                          - Create exam
    GET    /:id                       - Get exam details
    PUT    /:id                       - Update exam
    DELETE /:id                       - Delete exam
    GET    /:id/results               - Get exam results
    POST   /:id/results               - Add/update exam result
    GET    /:id/results/:studentId    - Get student's result
  
  /attendance
    GET    /                          - Get attendance records
    POST   /                          - Mark attendance
    GET    /roster                    - Get attendance roster for date
    PUT    /:id                       - Update attendance record
    GET    /stats                     - Get attendance statistics
  
  /performance
    GET    /                          - Get performance records
    POST   /                          - Record performance/grade
    GET    /student/:id               - Get student performance
    PUT    /:id                       - Update performance record
  
  /discipline
    GET    /                          - List discipline records
    POST   /                          - Create discipline record
    GET    /:id                       - Get discipline details
    PUT    /:id                       - Update discipline record
    GET    /student/:id               - Get student's discipline records
  
  /fees
    GET    /structures                - List fee structures
    POST   /structures                - Create fee structure
    PUT    /structures/:id            - Update fee structure
    GET    /student/:id               - Get student fees
    POST   /assign                    - Assign fee to student(s)
    POST   /payment                   - Record fee payment
    GET    /payments                  - List payments
    GET    /collection-summary        - Get collection summary
  
  /timetable
    GET    /                          - Get timetable
    POST   /                          - Create timetable entry
    PUT    /:id                       - Update timetable entry
    DELETE /:id                       - Delete timetable entry
    GET    /teacher/:id               - Get teacher's timetable
    GET    /class/:grade/:section     - Get class timetable
  
  /messages
    GET    /                          - List messages
    POST   /                          - Send message
    GET    /:id                       - Get message details
    PUT    /:id/read                  - Mark message as read
    DELETE /:id                       - Delete message
  
  /notifications
    GET    /                          - List notifications
    PUT    /:id/read                  - Mark as read
    PUT    /read-all                  - Mark all as read
    DELETE /:id                       - Delete notification
  
  /leave
    GET    /types                     - List leave types
    POST   /types                     - Create leave type
    GET    /requests                  - List leave requests
    POST   /requests                  - Create leave request
    PUT    /requests/:id              - Update leave request
    PUT    /requests/:id/approve      - Approve leave request
    PUT    /requests/:id/reject       - Reject leave request
  
  /reports
    GET    /financial-summary         - Financial reports
    GET    /performance-summary       - Performance reports
    GET    /school-analytics          - School analytics (super_admin)
    GET    /subscription-status       - Subscription status (super_admin)
    GET    /attendance-report         - Attendance reports
    GET    /student-progress/:id      - Student progress report
  
  /subscriptions
    GET    /plans                     - List subscription plans
    GET    /plans/:id                 - Get plan details
    POST   /plans                     - Create plan (super_admin)
    PUT    /plans/:id                 - Update plan (super_admin)
```

### 3.2 API Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation successful"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { /* additional error details */ }
}
```

**Paginated Response:**
```json
{
  "success": true,
  "data": [ /* array of items */ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## 4. Authentication & Security

### 4.1 JWT Token Strategy

```typescript
// Access Token (short-lived: 15 minutes)
{
  "id": 123,
  "email": "user@example.com",
  "role": "teacher",
  "schoolId": 45,
  "iat": 1234567890,
  "exp": 1234568790
}

// Refresh Token (long-lived: 7 days)
// Stored in database as hashed value
// Used to obtain new access tokens
```

### 4.2 Authentication Middleware

```typescript
// Middleware to verify JWT token
authenticateToken(req, res, next)

// Middleware to check user role
authorizeRole(['admin', 'teacher'])(req, res, next)

// Middleware to verify school access
verifySchoolAccess(req, res, next)

// Middleware to check subscription features
requireFeature('parentPortal')(req, res, next)
```

### 4.3 Security Measures

1. **Password Security**
   - bcrypt hashing (cost factor: 10)
   - Minimum 8 characters
   - Password reset tokens expire in 1 hour

2. **Rate Limiting**
   - Login: 5 attempts per 15 minutes
   - Registration: 3 per hour
   - General API: 100 requests per 15 minutes
   - Failed attempts tracking

3. **Input Validation**
   - Zod schemas for request validation
   - SQL injection prevention
   - XSS protection

4. **CORS Configuration**
   - Whitelist allowed origins
   - Credentials support
   - Preflight caching

5. **Token Management**
   - Refresh tokens stored hashed
   - Automatic token cleanup
   - Token revocation on logout

---

## 5. Multi-Tenancy Implementation

### 5.1 Tenant Isolation Strategy

**Database Level:**
```typescript
// Every query automatically filtered by school_id
app.use((req, res, next) => {
  if (req.user && req.user.schoolId) {
    req.schoolId = req.user.schoolId;
  }
  next();
});

// Example query helper
const getStudents = async (schoolId) => {
  return db.query(
    'SELECT * FROM students WHERE school_id = ?',
    [schoolId]
  );
};
```

**Middleware Approach:**
```typescript
// Tenant context middleware
const tenantContext = async (req, res, next) => {
  // Super admins can specify school_id in query
  if (req.user.role === 'super_admin' && req.query.schoolId) {
    req.schoolId = parseInt(req.query.schoolId);
  } else if (req.user.schoolId) {
    req.schoolId = req.user.schoolId;
  } else {
    return res.status(403).json({ error: 'No school context' });
  }
  next();
};
```

### 5.2 Subscription & Feature Flags

```typescript
// Check if school's subscription includes feature
const hasFeature = async (schoolId, feature) => {
  const subscription = await db.query(`
    SELECT sp.* 
    FROM subscriptions s
    JOIN subscription_plans sp ON s.plan_id = sp.id
    WHERE s.school_id = ? AND s.status = 'active'
  `, [schoolId]);
  
  return subscription[`include_${feature}`] === 1;
};

// Middleware to require feature
const requireFeature = (feature) => {
  return async (req, res, next) => {
    if (req.user.role === 'super_admin') return next();
    
    const hasAccess = await hasFeature(req.schoolId, feature);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Feature not available in current subscription plan'
      });
    }
    next();
  };
};
```

### 5.3 Usage Limits

```typescript
// Check usage against subscription limits
const checkUsageLimit = async (schoolId, type) => {
  const subscription = await getSubscription(schoolId);
  
  if (type === 'student' && subscription.studentLimit) {
    const count = await getStudentCount(schoolId);
    if (count >= subscription.studentLimit) {
      throw new Error('Student limit reached');
    }
  }
  
  if (type === 'staff' && subscription.staffLimit) {
    const count = await getStaffCount(schoolId);
    if (count >= subscription.staffLimit) {
      throw new Error('Staff limit reached');
    }
  }
};
```

---

## 6. Implementation Steps

### Phase 1: Foundation (Week 1-2)

**Week 1:**
- [ ] Set up project structure with TypeScript
- [ ] Configure PostgreSQL/MySQL database
- [ ] Create database migration system
- [ ] Implement all database tables
- [ ] Set up Express server with basic middleware
- [ ] Configure environment variables
- [ ] Set up logging system (Winston/Pino)

**Week 2:**
- [ ] Implement authentication system (JWT)
- [ ] Create user registration & login
- [ ] Implement password reset functionality
- [ ] Email verification system
- [ ] Token refresh mechanism
- [ ] Basic role-based access control

### Phase 2: Core Features (Week 3-5)

**Week 3:**
- [ ] School management CRUD
- [ ] Subscription plan management
- [ ] User management (staff, teachers)
- [ ] Multi-tenancy middleware
- [ ] Tenant isolation implementation

**Week 4:**
- [ ] Student management system
- [ ] Parent-student linking
- [ ] Academic year management
- [ ] Term/semester management
- [ ] Student promotion logic

**Week 5:**
- [ ] Course management
- [ ] Course enrollments
- [ ] Course resources
- [ ] Timetable system
- [ ] Class schedules

### Phase 3: Academic Features (Week 6-8)

**Week 6:**
- [ ] Assignment system
- [ ] Assignment submissions
- [ ] Grading functionality
- [ ] Exam management
- [ ] Exam results

**Week 7:**
- [ ] Attendance tracking
- [ ] Attendance roster
- [ ] Attendance reports
- [ ] Performance records
- [ ] Report card generation

**Week 8:**
- [ ] Discipline system
- [ ] Behavior tracking
- [ ] Parent notifications
- [ ] Fee management
- [ ] Payment tracking

### Phase 4: Communication & Reports (Week 9-10)

**Week 9:**
- [ ] Messaging system
- [ ] Announcements
- [ ] Notifications
- [ ] Email integration
- [ ] SMS integration (optional)

**Week 10:**
- [ ] Leave management
- [ ] Financial reports
- [ ] Performance reports
- [ ] Analytics dashboard
- [ ] Export functionality (PDF, Excel)

### Phase 5: Testing & Optimization (Week 11-12)

**Week 11:**
- [ ] Unit tests (Jest/Mocha)
- [ ] Integration tests
- [ ] API documentation (Swagger)
- [ ] Performance optimization
- [ ] Query optimization

**Week 12:**
- [ ] Security audit
- [ ] Load testing
- [ ] Bug fixes
- [ ] Documentation
- [ ] Deployment preparation

---

## 7. Technology Stack

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL (primary) or MySQL
- **ORM/Query Builder**: Prisma or Kysely (optional)

### Authentication & Security
- **JWT**: jsonwebtoken
- **Hashing**: bcrypt
- **Validation**: Zod
- **Rate Limiting**: express-rate-limit
- **CORS**: cors
- **Helmet**: helmet (security headers)

### Database & Migrations
- **Migration Tool**: node-pg-migrate or Knex.js
- **Connection Pool**: pg-pool

### File Storage
- **Local**: multer
- **Cloud**: AWS S3 or Cloudinary (for avatars, documents)

### Email & SMS
- **Email**: Nodemailer or SendGrid
- **SMS**: Twilio or Africa's Talking (for Kenya)

### Testing
- **Framework**: Jest or Vitest
- **API Testing**: Supertest
- **Mocking**: jest.mock()

### Logging & Monitoring
- **Logging**: Winston or Pino
- **Error Tracking**: Sentry (optional)
- **APM**: New Relic or DataDog (optional)

### Development Tools
- **API Documentation**: Swagger/OpenAPI
- **Code Quality**: ESLint, Prettier
- **Git Hooks**: Husky

---

## 8. Deployment Strategy

### 8.1 Environment Setup

```bash
# Development
DATABASE_URL=postgresql://localhost:5432/eduke_dev
NODE_ENV=development
PORT=3001

# Production
DATABASE_URL=postgresql://production-host/eduke_prod
NODE_ENV=production
PORT=3001
JWT_SECRET=<strong-secret>
JWT_REFRESH_SECRET=<strong-secret>
```

### 8.2 Deployment Options

**Option 1: Traditional VPS (DigitalOcean, Linode)**
- Ubuntu server
- Nginx reverse proxy
- PM2 process manager
- PostgreSQL database
- SSL certificates (Let's Encrypt)

**Option 2: Platform as a Service**
- Railway.app
- Render.com
- Heroku
- Database: Managed PostgreSQL

**Option 3: Containerized (Docker)**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

**Option 4: Serverless**
- AWS Lambda + API Gateway
- Database: RDS PostgreSQL
- File Storage: S3

### 8.3 Database Backup Strategy

```bash
# Daily backups
pg_dump -h localhost -U postgres eduke_prod > backup_$(date +%Y%m%d).sql

# Retention policy
- Daily backups: Keep for 7 days
- Weekly backups: Keep for 4 weeks
- Monthly backups: Keep for 12 months
```

### 8.4 Monitoring & Alerts

- Uptime monitoring (UptimeRobot)
- Error tracking (Sentry)
- Performance monitoring
- Database query performance
- API response times
- Disk space alerts
- Memory usage alerts

---

## 9. Next Steps

### To Get Started:

1. **Review and Approve Schema**
   - Review the database schema
   - Make any necessary adjustments
   - Confirm curriculum support (CBC, 8-4-4, etc.)

2. **Choose Database**
   - PostgreSQL (recommended for production)
   - MySQL (alternative)
   - SQLite (development only)

3. **Set Up Development Environment**
   - Install Node.js, PostgreSQL
   - Initialize project structure
   - Configure TypeScript

4. **Create Database**
   - Run SQL schema file
   - Seed initial data (plans, super admin)
   - Test connections

5. **Start Implementation**
   - Follow phase-by-phase implementation plan
   - Begin with Phase 1 (Foundation)
   - Build iteratively

### Database Schema File

To create a ready-to-use SQL file:
1. Copy all SQL from section 2 (Database Schema)
2. Save as `schema.sql`
3. Add seed data for subscription plans
4. Run: `psql -U postgres -d eduke < schema.sql`

### Questions to Consider:

1. **Database Choice**: PostgreSQL or MySQL?
2. **File Storage**: Local storage or cloud (S3/Cloudinary)?
3. **Email Service**: Nodemailer (SMTP) or SendGrid/AWS SES?
4. **Payment Integration**: M-Pesa for Kenya? Stripe for international?
5. **Deployment**: VPS, PaaS, or serverless?
6. **Mobile App**: Will you need mobile apps (React Native API compatibility)?

---

## 10. Conclusion

This comprehensive backend plan provides:

✅ **Complete Multi-Tenant Database Schema** - 30+ tables covering all features
✅ **RESTful API Architecture** - 100+ endpoints organized by domain
✅ **Authentication & Security** - JWT-based with role-based access control
✅ **Subscription Management** - Feature flags and usage limits
✅ **12-Week Implementation Plan** - Phased approach from foundation to production
✅ **Technology Stack Recommendations** - Modern, scalable solutions
✅ **Deployment Strategy** - Multiple options with best practices

The system supports multiple curriculums (CBC, 8-4-4, British, American, IB) and provides complete school management functionality from student enrollment to fee payments, academic performance tracking, and comprehensive reporting.

Ready to start implementation? Begin with Phase 1 and build incrementally!
