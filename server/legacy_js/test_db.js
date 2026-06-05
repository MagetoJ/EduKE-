require('dotenv').config();
const { dbAll } = require('./database');

async function check() {
  try {
    console.log('Checking database data...');
    const users = await dbAll('SELECT id, email, role, first_name, last_name FROM users LIMIT 5');
    console.log('Users:', users);
    const parents = await dbAll('SELECT id, email, first_name, last_name FROM users WHERE role = \'parent\'');
    console.log('Parents:', parents);
    const students = await dbAll('SELECT id, first_name, last_name, grade FROM students LIMIT 5');
    console.log('Students:', students);

    const relations = await dbAll('SELECT * FROM parent_student_relations LIMIT 5');
    console.log('Parent-Student Relations:', relations);

    const performance = await dbAll('SELECT COUNT(*) as count FROM performance');
    console.log('Performance records:', performance[0].count);

    const attendance = await dbAll('SELECT COUNT(*) as count FROM attendance');
    console.log('Attendance records:', attendance[0].count);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

check();