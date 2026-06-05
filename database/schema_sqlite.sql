-- EduKE SQLite Schema for Local Development
-- Minimal schema for timetable functionality

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    name TEXT,
    phone TEXT,
    date_of_birth DATE,
    gender TEXT,
    address TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'student',
    department TEXT,
    subject TEXT,
    class_assigned TEXT,
    employee_id TEXT,
    status TEXT DEFAULT 'active',
    is_verified INTEGER DEFAULT 0,
    email_verified_at TEXT,
    must_change_password INTEGER DEFAULT 0,
    last_login_at TEXT,
    mfa_enabled INTEGER DEFAULT 0,
    mfa_secret TEXT,
    failed_login_attempts INTEGER DEFAULT 0,
    last_failed_login_at TEXT,
    account_locked_until TEXT,
    hire_date DATE,
    termination_date DATE,
    salary REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    status TEXT DEFAULT 'trial',
    start_date DATE NOT NULL,
    end_date DATE,
    trial_ends_at TEXT,
    next_billing_date DATE,
    billing_cycle TEXT,
    amount REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id),
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);

-- Schools table
CREATE TABLE IF NOT EXISTS schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'Kenya',
    postal_code TEXT,
    curriculum TEXT DEFAULT 'cbc',
    level TEXT,
    principal TEXT,
    logo_url TEXT,
    primary_color TEXT,
    accent_color TEXT,
    grade_levels TEXT,
    registration_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    teacher_id INTEGER,
    academic_year_id INTEGER,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    grade TEXT,
    subject_area TEXT,
    schedule TEXT,
    classroom TEXT,
    credits INTEGER,
    max_students INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id),
    UNIQUE(school_id, code)
);

-- Timetable periods
CREATE TABLE IF NOT EXISTS timetable_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    period_number INTEGER,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_break INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id)
);

-- Timetable entries
CREATE TABLE IF NOT EXISTS timetable_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    academic_year_id INTEGER,
    term_id INTEGER,
    course_id INTEGER NOT NULL,
    teacher_id INTEGER,
    day_of_week TEXT NOT NULL,
    period_id INTEGER NOT NULL,
    grade TEXT,
    class_section TEXT,
    classroom TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (period_id) REFERENCES timetable_periods(id)
);

-- Subscription plans (minimal)
CREATE TABLE IF NOT EXISTS subscription_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    price_monthly REAL,
    price_annual REAL,
    student_limit INTEGER,
    staff_limit INTEGER,
    trial_duration_days INTEGER DEFAULT 14,
    include_parent_portal INTEGER DEFAULT 0,
    include_student_portal INTEGER DEFAULT 0,
    include_messaging INTEGER DEFAULT 0,
    include_finance INTEGER DEFAULT 0,
    include_advanced_reports INTEGER DEFAULT 0,
    include_leave_management INTEGER DEFAULT 0,
    include_ai_analytics INTEGER DEFAULT 0,
    is_trial INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Insert default subscription plans
INSERT OR IGNORE INTO subscription_plans (name, slug, description, price_monthly, price_annual, student_limit, staff_limit, trial_duration_days, include_parent_portal, include_student_portal, include_messaging, include_finance, include_advanced_reports, include_leave_management, include_ai_analytics, is_trial, is_active) VALUES
('Trial Plan', 'trial', 'Free 14-day trial with limited features', 0.00, 0.00, 50, 10, 14, 1, 1, 1, 1, 1, 1, 1, 1, 1),
('Basic Plan', 'basic', 'Perfect for small schools', 49.99, 499.99, 100, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1),
('Professional Plan', 'pro', 'Advanced features for growing schools', 99.99, 999.99, 500, 50, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1),
('Enterprise Plan', 'enterprise', 'Unlimited features for large institutions', 199.99, 1999.99, NULL, NULL, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1);

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    used_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Email Verification Tokens
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    used_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Refresh Tokens (JWT)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked INTEGER DEFAULT 0,
    revoked_at TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Academic Years
CREATE TABLE IF NOT EXISTS academic_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    name TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT DEFAULT 'upcoming',
    promotion_threshold REAL DEFAULT 50.00,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- Terms/Semesters
CREATE TABLE IF NOT EXISTS terms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    academic_year_id INTEGER NOT NULL,
    name TEXT,
    term_number INTEGER,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'upcoming',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
);

-- Course Enrollments
CREATE TABLE IF NOT EXISTS course_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    academic_year_id INTEGER,
    term_id INTEGER,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'enrolled',
    final_grade REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE SET NULL,
    UNIQUE(course_id, student_id, term_id)
);

-- Leave Types
CREATE TABLE IF NOT EXISTS leave_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    max_days_per_year INTEGER,
    requires_approval INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    leave_type_id INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    approved_by INTEGER,
    approved_at TEXT,
    rejection_reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    description TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    user_id INTEGER,
    parent_id INTEGER,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    date_of_birth DATE,
    gender TEXT,
    address TEXT,
    avatar_url TEXT,
    student_id_number TEXT,
    national_id TEXT,
    grade TEXT NOT NULL,
    class_section TEXT,
    enrollment_date DATE,
    graduation_date DATE,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES users(id)
);

-- Parent-student relations table
CREATE TABLE IF NOT EXISTS parent_student_relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    relation_type TEXT DEFAULT 'guardian',
    is_primary_contact INTEGER DEFAULT 0,
    is_financial_responsible INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE(parent_id, student_id)
);

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    teacher_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    total_marks REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (teacher_id) REFERENCES users(id)
);

-- Performance table
CREATE TABLE IF NOT EXISTS performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    assignment_id INTEGER,
    score REAL,
    grade TEXT,
    feedback TEXT,
    submitted_at TEXT,
    graded_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (assignment_id) REFERENCES assignments(id)
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER,
    date DATE NOT NULL,
    status TEXT NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- Student fees table
CREATE TABLE IF NOT EXISTS student_fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    fee_structure_id INTEGER,
    school_id INTEGER NOT NULL,
    amount_due REAL NOT NULL,
    amount_paid REAL DEFAULT 0,
    due_date DATE,
    payment_status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (school_id) REFERENCES schools(id)
);

-- Fee structures table
CREATE TABLE IF NOT EXISTS fee_structures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    fee_type TEXT NOT NULL,
    amount REAL NOT NULL,
    frequency TEXT DEFAULT 'annual',
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_school ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_token_expiry ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_token ON email_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_token ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_expiry ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_schools_slug ON schools(slug);
CREATE INDEX IF NOT EXISTS idx_school_status ON schools(status);
CREATE INDEX IF NOT EXISTS idx_subscription_school ON subscriptions(school_id);
CREATE INDEX IF NOT EXISTS idx_subscription_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_expiry ON subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_academic_year_school ON academic_years(school_id);
CREATE INDEX IF NOT EXISTS idx_academic_year_status ON academic_years(status);
CREATE INDEX IF NOT EXISTS idx_term_school ON terms(school_id);
CREATE INDEX IF NOT EXISTS idx_term_year ON terms(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_course ON course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_student ON course_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_type_school ON leave_types(school_id);
CREATE INDEX IF NOT EXISTS idx_leave_request_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_request_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_request_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_activity_school ON activity_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_courses_school ON courses(school_id);
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_courses_grade ON courses(grade);
CREATE INDEX IF NOT EXISTS idx_periods_school ON timetable_periods(school_id);
CREATE INDEX IF NOT EXISTS idx_timetable_school ON timetable_entries(school_id);
CREATE INDEX IF NOT EXISTS idx_timetable_day_period ON timetable_entries(day_of_week, period_id);
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_parent ON students(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_relations ON parent_student_relations(parent_id);
CREATE INDEX IF NOT EXISTS idx_student_relations ON parent_student_relations(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_school ON assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_performance_student ON performance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_fees_student ON student_fees(student_id);