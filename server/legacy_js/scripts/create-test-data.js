const { query } = require('../db/connection');

async function createTestData() {
  try {
    console.log('Creating test data for timetable...');

    // Create a test school
    const schoolResult = await query(
      `INSERT INTO schools (name, slug, email, curriculum, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['Test School', 'test-school', 'test@school.com', 'cbc', 'active']
    );

    const schoolId = schoolResult.lastID;
    console.log(`Created school with ID: ${schoolId}`);

    // Create some courses
    const courses = [
      { name: 'Mathematics', code: 'MATH101', grade: 'Grade 10' },
      { name: 'English', code: 'ENG101', grade: 'Grade 10' },
      { name: 'Science', code: 'SCI101', grade: 'Grade 10' },
      { name: 'History', code: 'HIST101', grade: 'Grade 10' }
    ];

    for (const course of courses) {
      const courseResult = await query(
        `INSERT INTO courses (school_id, name, code, grade)
         VALUES (?, ?, ?, ?)`,
        [schoolId, course.name, course.code, course.grade]
      );
      console.log(`Created course: ${course.name} (ID: ${courseResult.lastID})`);
    }

    // Create timetable periods (1-hour intervals from 8am to 3pm with breaks)
    const periods = [
      { name: 'Period 1', start_time: '08:00', end_time: '09:00' },
      { name: 'Period 2', start_time: '09:00', end_time: '10:00' },
      { name: 'Break (15 min)', start_time: '10:00', end_time: '10:15', is_break: true },
      { name: 'Period 3', start_time: '10:15', end_time: '11:15' },
      { name: 'Period 4', start_time: '11:15', end_time: '12:15' },
      { name: 'Break (30 min)', start_time: '12:15', end_time: '12:45', is_break: true },
      { name: 'Period 5', start_time: '12:45', end_time: '13:45' },
      { name: 'Period 6', start_time: '13:45', end_time: '14:45' },
      { name: 'Break (1 hr)', start_time: '14:45', end_time: '15:45', is_break: true }
    ];

    for (const period of periods) {
      const periodResult = await query(
        `INSERT INTO timetable_periods (school_id, name, start_time, end_time, is_break)
         VALUES (?, ?, ?, ?, ?)`,
        [schoolId, period.name, period.start_time, period.end_time, period.is_break || false]
      );
      console.log(`Created period: ${period.name} (ID: ${periodResult.lastID})`);
    }

    // Create a test admin user for the school
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash('admin123', 10);

    const adminResult = await query(
      `INSERT INTO users (school_id, email, password_hash, first_name, last_name, name, role, status, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, 'admin@testschool.com', passwordHash, 'School', 'Admin', 'School Admin', 'admin', 'active', true]
    );

    console.log(`Created school admin with ID: ${adminResult.lastID}`);
    console.log('\nTest data created successfully!');
    console.log('\nYou can now:');
    console.log('1. Login as super admin: superadmin@eduke.com / SuperAdmin2024!');
    console.log('2. Or login as school admin: admin@testschool.com / admin123');
    console.log('3. Access the timetable page to test functionality');

  } catch (error) {
    console.error('Error creating test data:', error);
  }
}

createTestData();