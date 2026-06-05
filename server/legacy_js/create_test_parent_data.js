require('dotenv').config();
const { dbRun, dbAll } = require('./database');

async function createTestParentData() {
  try {
    console.log('Creating test parent-student relationships and data...');

    // Get existing parents and students
    const parents = await dbAll('SELECT id, email FROM users WHERE role = \'parent\'');
    const students = await dbAll('SELECT id, first_name, last_name FROM students');

    console.log(`Found ${parents.length} parents and ${students.length} students`);

    // Create parent-student relationships
    // Assign first student to first parent, second student to second parent, etc.
    for (let i = 0; i < Math.min(parents.length, students.length); i++) {
      const parent = parents[i];
      const student = students[i];

      // Check if relationship already exists
      const existing = await dbAll('SELECT id FROM parent_student_relations WHERE parent_id = $1 AND student_id = $2', [parent.id, student.id]);

      if (existing.length === 0) {
        await dbRun('INSERT INTO parent_student_relations (parent_id, student_id, relation_type, is_primary_contact) VALUES ($1, $2, $3, $4)',
          [parent.id, student.id, 'father', true]);
        console.log(`Created relationship: ${parent.email} -> ${student.first_name} ${student.last_name}`);
      } else {
        console.log(`Relationship already exists: ${parent.email} -> ${student.first_name} ${student.last_name}`);
      }
    }

    // Create some performance data for students
    console.log('Creating performance data...');
    for (const student of students) {
      // Get student with school_id
      const studentWithSchool = await dbAll('SELECT id, school_id FROM students WHERE id = $1', [student.id]);
      const schoolId = studentWithSchool[0].school_id;

      // Add some sample performance records
      const subjects = ['Mathematics', 'English', 'Science'];
      for (const subject of subjects) {
        await dbRun('INSERT INTO performance (school_id, student_id, subject, grade, max_grade, assessment_type, date_recorded) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [schoolId, student.id, subject, Math.floor(Math.random() * 40) + 60, 100, 'exam', new Date().toISOString().split('T')[0]]);
      }
    }

    // Create some attendance data
    console.log('Creating attendance data...');
    for (const student of students) {
      // Get student with school_id
      const studentWithSchool = await dbAll('SELECT id, school_id FROM students WHERE id = $1', [student.id]);
      const schoolId = studentWithSchool[0].school_id;

      // Add attendance for the last 10 days
      for (let i = 0; i < 10; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const status = Math.random() > 0.1 ? 'present' : 'absent'; // 90% present

        await dbRun('INSERT INTO attendance (school_id, student_id, date, status) VALUES ($1, $2, $3, $4)',
          [schoolId, student.id, date.toISOString().split('T')[0], status]);
      }
    }

    // Create some fee data
    console.log('Creating fee data...');
    for (const student of students) {
      await dbRun('INSERT INTO student_fees (student_id, school_id, amount_due, amount_paid, due_date, payment_status) VALUES ($1, $2, $3, $4, $5, $6)',
        [student.id, 1, 5000, 3000, '2024-12-31', 'partial']);
    }

    console.log('Test data created successfully!');

    // Verify the data
    const relations = await dbAll('SELECT COUNT(*) as count FROM parent_student_relations');
    const performance = await dbAll('SELECT COUNT(*) as count FROM performance');
    const attendance = await dbAll('SELECT COUNT(*) as count FROM attendance');
    const fees = await dbAll('SELECT COUNT(*) as count FROM student_fees');

    console.log(`Created ${relations[0].count} parent-student relationships`);
    console.log(`Created ${performance[0].count} performance records`);
    console.log(`Created ${attendance[0].count} attendance records`);
    console.log(`Created ${fees[0].count} fee records`);

  } catch (error) {
    console.error('Error creating test data:', error);
  }
}

createTestParentData();