const { dbRun, dbAll } = require('./server/database');

async function createTestData() {
  try {
    console.log('Creating test parent and student data...');

    // Create a test parent user
    const parentResult = await dbRun(`
      INSERT OR IGNORE INTO users (email, password_hash, first_name, last_name, name, role, status, is_verified)
      VALUES ('parent@test.com', '$2b$10$dummy.hash.for.testing', 'John', 'Doe', 'John Doe', 'parent', 'active', true)
    `);
    console.log('Parent user created with ID:', parentResult.lastID);

    // Create a test student
    const studentResult = await dbRun(`
      INSERT OR IGNORE INTO students (school_id, first_name, last_name, email, grade, class_section, status)
      VALUES (1, 'Jane', 'Doe', 'jane@test.com', 'Grade 8', 'A', 'active')
    `);
    console.log('Student created with ID:', studentResult.lastID);

    // Create parent-student relationship
    if (parentResult.lastID && studentResult.lastID) {
      await dbRun(`
        INSERT OR IGNORE INTO parent_student_relations (parent_id, student_id, relation_type, is_primary_contact)
        VALUES (?, ?, 'father', ?)
      `, [parentResult.lastID, studentResult.lastID, true]);
      console.log('Parent-student relationship created');
    }

    // Create some test assignments
    await dbRun(`
      INSERT OR IGNORE INTO assignments (school_id, course_id, teacher_id, title, description, due_date, total_marks)
      VALUES (1, 1, 2, 'Math Homework', 'Complete exercises 1-10', '2024-12-01', 100)
    `);

    await dbRun(`
      INSERT OR IGNORE INTO assignments (school_id, course_id, teacher_id, title, description, due_date, total_marks)
      VALUES (1, 1, 2, 'Science Project', 'Research on solar system', '2024-12-15', 50)
    `);

    // Create some test performance data
    await dbRun(`
      INSERT OR IGNORE INTO performance (student_id, assignment_id, score, grade, submitted_at)
      VALUES (?, 1, 85, 'B', datetime('now'))
    `, [studentResult.lastID]);

    // Create some test attendance data
    await dbRun(`
      INSERT OR IGNORE INTO attendance (student_id, course_id, date, status)
      VALUES (?, 1, '2024-11-01', 'present')
    `, [studentResult.lastID]);

    await dbRun(`
      INSERT OR IGNORE INTO attendance (student_id, course_id, date, status)
      VALUES (?, 1, '2024-11-02', 'present')
    `, [studentResult.lastID]);

    await dbRun(`
      INSERT OR IGNORE INTO attendance (student_id, course_id, date, status)
      VALUES (?, 1, '2024-11-03', 'absent')
    `, [studentResult.lastID]);

    // Create some test fee data
    await dbRun(`
      INSERT OR IGNORE INTO student_fees (student_id, school_id, amount_due, amount_paid, due_date, payment_status)
      VALUES (?, 1, 5000, 3000, '2024-12-31', 'partial')
    `, [studentResult.lastID]);

    console.log('Test data created successfully!');

    // Verify the data
    const parents = await dbAll('SELECT id, name, email FROM users WHERE role = ?', ['parent']);
    console.log('Parents:', parents);

    const relations = await dbAll('SELECT * FROM parent_student_relations');
    console.log('Relations:', relations);

  } catch (error) {
    console.error('Error creating test data:', error);
  }
}

createTestData();