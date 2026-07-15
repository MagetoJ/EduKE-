-- 1. Daily Attendance Register
CREATE TABLE IF NOT EXISTS daily_attendance (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late')),
    remarks TEXT,
    recorded_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, date)
);

-- 2. Holistic Composite Term Remarks (Report Card Summaries)
CREATE TABLE IF NOT EXISTS class_teacher_remarks (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
    term INT NOT NULL CHECK (term BETWEEN 1 AND 3),
    remarks TEXT NOT NULL,
    recorded_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, academic_year_id, term)
);

-- 3. Student Welfare & Behavioural Escalations
CREATE TABLE IF NOT EXISTS student_welfare_escalations (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    escalated_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(255) NOT NULL, -- e.g., 'Chronic Absenteeism', 'Behavioral Issue', 'Fee Balance'
    details TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_daily_attendance_date ON daily_attendance(school_id, date);
CREATE INDEX IF NOT EXISTS idx_welfare_student ON student_welfare_escalations(student_id);