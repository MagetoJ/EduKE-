const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL.includes('render.com') 
    ? { rejectUnauthorized: false } 
    : false
});

async function addCurriculumAssessment() {
  const client = await pool.connect();
  try {
    console.log('Adding curriculum-specific assessment tables...\n');

    console.log('Creating grading_schemes table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS grading_schemes (
        id SERIAL PRIMARY KEY,
        school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        
        curriculum VARCHAR(50) NOT NULL CHECK (curriculum IN ('cbc', '844', 'british', 'american', 'ib')),
        
        grade_name VARCHAR(10),
        grade_letter VARCHAR(5),
        min_score DECIMAL(5,2),
        max_score DECIMAL(5,2),
        
        points DECIMAL(5,2),
        
        description TEXT,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(school_id, curriculum, grade_name)
      );
      CREATE INDEX idx_grading_scheme_school ON grading_schemes(school_id);
      CREATE INDEX idx_grading_scheme_curriculum ON grading_schemes(curriculum);
    `);
    console.log('✓ grading_schemes created');

    console.log('Adding curriculum-specific columns to performance table...');
    await client.query(`
      ALTER TABLE performance
      ADD COLUMN IF NOT EXISTS predicted_grade VARCHAR(5),
      ADD COLUMN IF NOT EXISTS effort_grade INT,
      ADD COLUMN IF NOT EXISTS criteria_scores JSONB,
      ADD COLUMN IF NOT EXISTS credit_earned DECIMAL(5,2),
      ADD COLUMN IF NOT EXISTS mean_score DECIMAL(5,2),
      ADD COLUMN IF NOT EXISTS curriculum VARCHAR(50) DEFAULT 'cbc'
    `);
    console.log('✓ performance table updated');

    console.log('Creating 844_system_assessments table (for 8-4-4 system)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS assessment_844_system (
        id SERIAL PRIMARY KEY,
        school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
        term_id INT REFERENCES terms(id) ON DELETE SET NULL,
        
        form INT CHECK (form IN (1, 2, 3, 4)),
        stream VARCHAR(100),
        
        subject VARCHAR(100) NOT NULL,
        marks_obtained INT,
        max_marks INT DEFAULT 100,
        
        grade_letter VARCHAR(1),
        points INT,
        
        is_compulsory BOOLEAN DEFAULT TRUE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(student_id, academic_year_id, term_id, subject)
      );
      CREATE INDEX idx_844_student ON assessment_844_system(student_id);
      CREATE INDEX idx_844_year_term ON assessment_844_system(academic_year_id, term_id);
    `);
    console.log('✓ assessment_844_system created');

    console.log('Creating british_curriculum_assessments table (for IGCSE/GCE)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS assessment_british_curriculum (
        id SERIAL PRIMARY KEY,
        school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
        term_id INT REFERENCES terms(id) ON DELETE SET NULL,
        
        key_stage VARCHAR(10) CHECK (key_stage IN ('KS1', 'KS2', 'KS3', 'KS4', 'KS5')),
        subject VARCHAR(100) NOT NULL,
        
        attainment_grade VARCHAR(5),
        effort_grade INT CHECK (effort_grade BETWEEN 1 AND 5),
        
        predicted_grade VARCHAR(5),
        mock_result VARCHAR(5),
        
        checkpoint_score DECIMAL(5,2),
        
        teacher_notes TEXT,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(student_id, academic_year_id, term_id, subject)
      );
      CREATE INDEX idx_british_student ON assessment_british_curriculum(student_id);
      CREATE INDEX idx_british_keystage ON assessment_british_curriculum(key_stage);
    `);
    console.log('✓ assessment_british_curriculum created');

    console.log('Creating american_curriculum_assessments table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS assessment_american_curriculum (
        id SERIAL PRIMARY KEY,
        school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
        
        course_id INT REFERENCES courses(id) ON DELETE SET NULL,
        
        grade_level VARCHAR(20) CHECK (grade_level IN ('9', '10', '11', '12')),
        
        subject VARCHAR(100) NOT NULL,
        
        letter_grade VARCHAR(2),
        gpa_points DECIMAL(3,2),
        
        credits_earned DECIMAL(5,2),
        
        map_rit_score INT,
        map_percentile INT,
        
        transcript_notes TEXT,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(student_id, academic_year_id, course_id)
      );
      CREATE INDEX idx_american_student ON assessment_american_curriculum(student_id);
      CREATE INDEX idx_american_course ON assessment_american_curriculum(course_id);
    `);
    console.log('✓ assessment_american_curriculum created');

    console.log('Creating ib_assessments table (for IB)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS assessment_ib (
        id SERIAL PRIMARY KEY,
        school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        academic_year_id INT REFERENCES academic_years(id) ON DELETE SET NULL,
        
        subject VARCHAR(100) NOT NULL,
        
        programme VARCHAR(20) CHECK (programme IN ('DP', 'MYP')),
        
        criterion_a INT CHECK (criterion_a BETWEEN 0 AND 8),
        criterion_b INT CHECK (criterion_b BETWEEN 0 AND 8),
        criterion_c INT CHECK (criterion_c BETWEEN 0 AND 8),
        criterion_d INT CHECK (criterion_d BETWEEN 0 AND 8),
        
        total_criteria_score INT,
        final_grade INT CHECK (final_grade BETWEEN 1 AND 7),
        
        internal_assessment_score INT,
        external_assessment_score INT,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(student_id, academic_year_id, subject)
      );
      CREATE INDEX idx_ib_student ON assessment_ib(student_id);
      CREATE INDEX idx_ib_programme ON assessment_ib(programme);
    `);
    console.log('✓ assessment_ib created');

    console.log('Creating ib_cas_portfolio table (for IB CAS)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ib_cas_portfolio (
        id SERIAL PRIMARY KEY,
        school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        
        activity_title VARCHAR(255) NOT NULL,
        activity_type VARCHAR(20) CHECK (activity_type IN ('creativity', 'activity', 'service')),
        
        start_date DATE,
        end_date DATE,
        
        hours_logged DECIMAL(5,2),
        description TEXT,
        
        evidence_url TEXT,
        evidence_type VARCHAR(50) CHECK (evidence_type IN ('photo', 'video', 'journal', 'certificate', 'other')),
        
        reflection TEXT,
        
        supervisor_id INT REFERENCES users(id) ON DELETE SET NULL,
        supervisor_approval BOOLEAN DEFAULT FALSE,
        supervisor_comments TEXT,
        
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'completed')),
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_cas_student ON ib_cas_portfolio(student_id);
      CREATE INDEX idx_cas_type ON ib_cas_portfolio(activity_type);
    `);
    console.log('✓ ib_cas_portfolio created');

    console.log('Creating merit_lists table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS merit_lists (
        id SERIAL PRIMARY KEY,
        school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        academic_year_id INT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
        term_id INT REFERENCES terms(id) ON DELETE SET NULL,
        
        grade_level VARCHAR(50),
        stream VARCHAR(100),
        
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        
        position INT,
        mean_score DECIMAL(5,2),
        aggregate_score DECIMAL(5,2),
        
        total_students_in_class INT,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(academic_year_id, term_id, grade_level, stream, student_id)
      );
      CREATE INDEX idx_merit_list_year_term ON merit_lists(academic_year_id, term_id);
      CREATE INDEX idx_merit_list_grade ON merit_lists(grade_level);
    `);
    console.log('✓ merit_lists created');

    console.log('\n✓ All curriculum assessment tables created successfully!');
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✓ Tables already exist');
    } else {
      console.error('Error creating tables:', error);
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

addCurriculumAssessment();
