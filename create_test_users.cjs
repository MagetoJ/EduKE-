const { dbRun } = require('./server/database');
const bcrypt = require('bcrypt');
const { SALT_ROUNDS } = require('./server/config');

async function createTestUsers() {
  try {
    console.log('Creating test users...');

    // Create a teacher account
    const teacherPassword = 'teacher123';
    const teacherHash = await bcrypt.hash(teacherPassword, SALT_ROUNDS);

    const teacherResult = await dbRun(
      'INSERT INTO users (name, email, password_hash, role, school_id, is_verified, email_verified_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['John Teacher', 'teacher@homabay.ac.ke', teacherHash, 'teacher', 1, true, new Date().toISOString(), 'active']
    );
    console.log(`Created teacher with ID: ${teacherResult.lastID}`);

    // Create a parent account
    const parentPassword = 'parent123';
    const parentHash = await bcrypt.hash(parentPassword, SALT_ROUNDS);

    const parentResult = await dbRun(
      'INSERT INTO users (name, email, password_hash, role, school_id, is_verified, email_verified_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['Jane Parent', 'parent@homabay.ac.ke', parentHash, 'parent', 1, true, new Date().toISOString(), 'active']
    );
    console.log(`Created parent with ID: ${parentResult.lastID}`);

    // Create a student record (note: students are in a separate table)
    const studentResult = await dbRun(
      'INSERT INTO students (first_name, last_name, email, grade, school_id, parent_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['Alice', 'Student', 'alice@student.homabay.ac.ke', 'Grade 1', 1, parentResult.lastID, 'active']
    );
    console.log(`Created student with ID: ${studentResult.lastID}`);

    console.log('\nTest accounts created successfully!');
    console.log('Teacher: teacher@homabay.ac.ke / teacher123');
    console.log('Parent: parent@homabay.ac.ke / parent123');
    console.log('Student: alice@student.homabay.ac.ke (no password - students access via parent portal)');

    process.exit(0);
  } catch (error) {
    console.error('Error creating test users:', error);
    process.exit(1);
  }
}

createTestUsers();