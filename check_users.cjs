const { dbGet, dbAll } = require('./server/database');

async function checkUsers() {
  try {
    console.log('Checking users in database...');

    // Get all users
    const users = await dbAll('SELECT id, name, email, role, school_id FROM users');
    console.log('All users:');
    users.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - Role: ${user.role}`);
    });

    // Get teachers specifically
    const teachers = await dbAll('SELECT id, name, email, role FROM users WHERE role = ?', ['teacher']);
    console.log('\nTeachers:');
    teachers.forEach(teacher => {
      console.log(`- ${teacher.name} (${teacher.email})`);
    });

    // Get parents
    const parents = await dbAll('SELECT id, name, email, role FROM users WHERE role = ?', ['parent']);
    console.log('\nParents:');
    parents.forEach(parent => {
      console.log(`- ${parent.name} (${parent.email})`);
    });

    // Get parent-student relationships
    const relations = await dbAll('SELECT * FROM parent_student_relations');
    console.log('\nParent-Student Relations:');
    relations.forEach(relation => {
      console.log(`- Parent ID: ${relation.parent_id}, Student ID: ${relation.student_id}`);
    });

    // Get students
    const students = await dbAll('SELECT id, first_name, last_name, grade FROM students LIMIT 5');
    console.log('\nSample Students:');
    students.forEach(student => {
      console.log(`- ${student.first_name} ${student.last_name} (Grade: ${student.grade})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUsers();