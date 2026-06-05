-- CBC Strands
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

CREATE INDEX IF NOT EXISTS idx_cbc_strand_school ON cbc_strands(school_id);

-- CBC Assessments
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

CREATE INDEX IF NOT EXISTS idx_cbc_assessment_school ON cbc_assessments(school_id);

-- CBC Learner Portfolios
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

CREATE INDEX IF NOT EXISTS idx_cbc_portfolios_school ON cbc_learner_portfolios(school_id);

-- NEMIS Registration
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

CREATE INDEX IF NOT EXISTS idx_nemis_school ON nemis_student_registration(school_id);

-- KNEC Registration
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

CREATE INDEX IF NOT EXISTS idx_knec_school ON knec_candidate_registration(school_id);

-- M-PESA Transactions
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

CREATE INDEX IF NOT EXISTS idx_mpesa_school ON mpesa_transactions(school_id);

-- Boarding Houses & Rooms
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

CREATE INDEX IF NOT EXISTS idx_boarding_houses_school ON boarding_houses(school_id);

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

CREATE INDEX IF NOT EXISTS idx_boarding_rooms_house ON boarding_rooms(boarding_house_id);

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

CREATE INDEX IF NOT EXISTS idx_boarding_enrollments_school ON boarding_enrollments(school_id);

-- Boarding Assignments
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

CREATE INDEX IF NOT EXISTS idx_boarding_school ON boarding_assignments(school_id);

-- Boarding Exeat Requests
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

CREATE INDEX IF NOT EXISTS idx_exeat_school ON boarding_exeat_requests(school_id);

-- Kitchen Inventory
CREATE TABLE IF NOT EXISTS kitchen_inventory_logs (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20),
    usage_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kitchen_school ON kitchen_inventory_logs(school_id);

-- Textbook Issuance
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

CREATE INDEX IF NOT EXISTS idx_textbook_school ON textbook_issuance_logs(school_id);

-- SMS Campaigns
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

CREATE INDEX IF NOT EXISTS idx_campaign_school ON sms_campaigns(school_id);

-- Transport Routes & Enrollments
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

CREATE INDEX IF NOT EXISTS idx_transport_routes_school ON transport_routes(school_id);

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

CREATE INDEX IF NOT EXISTS idx_transport_enrollments_school ON transport_enrollments(school_id);

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

CREATE INDEX IF NOT EXISTS idx_transport_assignments_school ON transport_assignments(school_id);

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

CREATE INDEX IF NOT EXISTS idx_transport_attendance_school ON transport_attendance(school_id);

-- Specialized Curriculum Tables
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

CREATE INDEX IF NOT EXISTS idx_grading_scheme_school ON grading_schemes(school_id);

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

CREATE INDEX IF NOT EXISTS idx_assessment_844_student ON assessment_844_system(student_id);

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

CREATE INDEX IF NOT EXISTS idx_british_assessment_student ON assessment_british_curriculum(student_id);

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

CREATE INDEX IF NOT EXISTS idx_american_assessment_student ON assessment_american_curriculum(student_id);

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

CREATE INDEX IF NOT EXISTS idx_ib_assessment_student ON assessment_ib(student_id);

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

CREATE INDEX IF NOT EXISTS idx_ib_cas_school ON ib_cas_portfolio(school_id);

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

CREATE INDEX IF NOT EXISTS idx_merit_lists_school ON merit_lists(school_id);
