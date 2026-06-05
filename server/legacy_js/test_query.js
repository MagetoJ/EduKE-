require('dotenv').config();
const { dbAll } = require('./database');

async function testQuery() {
  try {
    console.log('Testing the parent children query...');

    // Test the exact query from complete.js
    const query = `
      SELECT
        s.id,
        s.first_name,
        s.last_name,
        s.email,
        s.phone,
        s.date_of_birth,
        s.gender,
        s.grade,
        s.class_section as class_assigned,
        s.student_id_number as admission_number,
        s.status
      FROM students s
      JOIN parent_student_relations psr ON s.id = psr.student_id
      WHERE psr.parent_id = $1 AND s.school_id = $2 AND s.status = 'active'
      ORDER BY s.first_name, s.last_name
    `;

    // Use a parent ID that exists (from our earlier check, parent ID 5)
    const result = await dbAll(query, [5, 1]);
    console.log('Query result:', result);

  } catch (e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
  }
}

testQuery();