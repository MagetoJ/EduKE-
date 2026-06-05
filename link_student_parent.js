import { query } from './server/db/connection.js';

async function linkStudentToParent() {
  try {
    console.log('Finding student with email: junior@gmail.com');

    // Find the student
    const studentResult = await query('SELECT id, first_name, last_name, email FROM users WHERE email = $1 AND role = $2', ['junior@gmail.com', 'student']);
    console.log('Student found:', studentResult.rows[0]);

    console.log('Finding parent with email: jmaget@statbrick.som');

    // Find the parent
    const parentResult = await query('SELECT id, first_name, last_name, email FROM users WHERE email = $1 AND role = $2', ['jmaget@statbrick.som', 'parent']);
    console.log('Parent found:', parentResult.rows[0]);

    if (studentResult.rows.length === 0 || parentResult.rows.length === 0) {
      console.log('Student or parent not found');
      return;
    }

    const studentId = studentResult.rows[0].id;
    const parentId = parentResult.rows[0].id;

    console.log('Finding student record in students table');

    // Check if student record exists
    const studentRecord = await query('SELECT id, first_name, last_name FROM students WHERE user_id = $1', [studentId]);
    console.log('Student record:', studentRecord.rows[0]);

    if (studentRecord.rows.length === 0) {
      console.log('Student record not found in students table');
      return;
    }

    const studentRecordId = studentRecord.rows[0].id;

    console.log('Updating student parent_id');

    // Update the student record to link to parent
    await query('UPDATE students SET parent_id = $1 WHERE id = $2', [parentId, studentRecordId]);
    console.log('Updated student parent_id');

    console.log('Creating parent-student relationship');

    // Create parent-student relationship
    await query(
      'INSERT INTO parent_student_relations (parent_id, student_id, relation_type, is_primary_contact, is_financial_responsible) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (parent_id, student_id) DO NOTHING',
      [parentId, studentRecordId, 'guardian', true, true]
    );
    console.log('Created parent-student relationship');

    console.log('Successfully linked student to parent');

  } catch (error) {
    console.error('Error:', error);
  }
}

linkStudentToParent();