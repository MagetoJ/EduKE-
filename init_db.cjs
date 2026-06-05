const { dbRun } = require('./server/database');

async function initDatabase() {
  try {
    console.log('Creating database tables...');

    // Create tables
    await dbRun(`CREATE TABLE IF NOT EXISTS students (
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
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS parent_student_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      relation_type TEXT DEFAULT 'guardian',
      is_primary_contact INTEGER DEFAULT 0,
      is_financial_responsible INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(parent_id, student_id)
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      teacher_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      due_date DATE,
      total_marks REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS performance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      assignment_id INTEGER,
      score REAL,
      grade TEXT,
      feedback TEXT,
      submitted_at TEXT,
      graded_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      course_id INTEGER,
      date DATE NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS student_fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      fee_structure_id INTEGER,
      school_id INTEGER NOT NULL,
      amount_due REAL NOT NULL,
      amount_paid REAL DEFAULT 0,
      due_date DATE,
      payment_status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log('Tables created successfully');

    // Insert test data
    console.log('Inserting test data...');

    const parentResult = await dbRun(`
      INSERT OR IGNORE INTO users (email, password_hash, first_name, last_name, name, role, status, is_verified)
      VALUES ('parent@test.com', '$2b$10$dummy.hash.for.testing', 'John', 'Doe', 'John Doe', 'parent', 'active', true)
    `);
    console.log('Parent inserted');

    const studentResult = await dbRun(`
      INSERT OR IGNORE INTO students (school_id, first_name, last_name, email, grade, class_section, status)
      VALUES (1, 'Jane', 'Doe', 'jane@test.com', 'Grade 8', 'A', 'active')
    `);
    console.log('Student inserted');

    await dbRun(`
      INSERT OR IGNORE INTO parent_student_relations (parent_id, student_id, relation_type, is_primary_contact)
      VALUES (3, 1, 'father', true)
    `);
    console.log('Parent-student relation created');

    await dbRun(`
      INSERT OR IGNORE INTO assignments (school_id, course_id, teacher_id, title, description, due_date, total_marks)
      VALUES (1, 1, 2, 'Math Homework', 'Complete exercises 1-10', '2024-12-01', 100)
    `);
    console.log('Assignment inserted');

    await dbRun(`
      INSERT OR IGNORE INTO performance (student_id, assignment_id, score, grade, submitted_at)
      VALUES (1, 1, 85, 'B', datetime('now'))
    `);
    console.log('Performance inserted');

    await dbRun(`
      INSERT OR IGNORE INTO attendance (student_id, course_id, date, status)
      VALUES (1, 1, '2024-11-01', 'present')
    `);
    console.log('Attendance inserted');

    await dbRun(`
      INSERT OR IGNORE INTO student_fees (student_id, school_id, amount_due, amount_paid, due_date, payment_status)
      VALUES (1, 1, 5000, 3000, '2024-12-31', 'partial')
    `);
    console.log('Fees inserted');

    console.log('Database initialization completed successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

initDatabase();