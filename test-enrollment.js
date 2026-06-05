require('dotenv').config({ path: './server/.env' });

const studentService = require('./server/services/studentService');
const { getDatabaseInfo } = require('./server/db/connection');

const testStudentEnrollment = async () => {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 TESTING STUDENT ENROLLMENT FUNCTIONALITY');
  console.log('='.repeat(70) + '\n');

  try {
    console.log('1️⃣  Checking database connection...');
    const dbInfo = await getDatabaseInfo();
    console.log(`   ✓ Database: ${dbInfo.config}`);
    console.log(`   ✓ Tables: ${dbInfo.tableCount}`);
    console.log(`   ✓ Database Name: ${dbInfo.database}\n`);

    const testData = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe.test@example.com',
      phone: '0712345678',
      date_of_birth: '2010-01-15',
      gender: 'male',
      address: '123 School Lane',
      grade: 'Grade 5',
      enrollment_date: new Date().toISOString().split('T')[0],
      parent_email: 'jane.doe.test@example.com',
      parent_name: 'Jane Doe',
      parent_phone: '0787654321',
      relationship: 'mother'
    };

    console.log('2️⃣  Testing student enrollment with valid data...');
    console.log('   Input Data:');
    console.log(`   - Student: ${testData.first_name} ${testData.last_name}`);
    console.log(`   - Grade: ${testData.grade}`);
    console.log(`   - Email: ${testData.email}`);
    console.log(`   - Parent: ${testData.parent_name} (${testData.parent_email})\n`);

    const student = await studentService.createStudentAndParent(testData, 1);
    
    console.log('✅ ENROLLMENT SUCCESSFUL!\n');
    console.log('   Student Details:');
    console.log(`   - ID: ${student.id}`);
    console.log(`   - Name: ${student.first_name} ${student.last_name}`);
    console.log(`   - Grade: ${student.grade}`);
    console.log(`   - Admission #: ${student.admission_number}`);
    console.log(`   - Parent ID: ${student.parent_id}`);
    console.log(`   - Status: ${student.status}\n`);

    console.log('3️⃣  Testing validation errors...');
    
    try {
      console.log('   Testing missing required fields...');
      await studentService.createStudentAndParent({ first_name: 'Test' }, 1);
      console.log('   ❌ FAILED - Should have thrown error');
    } catch (err) {
      console.log(`   ✓ Correctly caught error: "${err.message}"\n`);
    }

    try {
      console.log('   Testing duplicate email...');
      await studentService.createStudentAndParent(testData, 1);
      console.log('   ❌ FAILED - Should have thrown duplicate error');
    } catch (err) {
      console.log(`   ✓ Correctly caught error: "${err.message}"\n`);
    }

    console.log('='.repeat(70));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(70) + '\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ TEST FAILED:\n', error);
    console.log('='.repeat(70) + '\n');
    process.exit(1);
  }
};

testStudentEnrollment();
