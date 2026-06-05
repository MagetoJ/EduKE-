const { dbAll } = require('./server/database');

async function checkSchools() {
  try {
    console.log('Checking schools in database...');

    const schools = await dbAll('SELECT id, name, email FROM schools');
    console.log('Schools:');
    schools.forEach(school => {
      console.log(`- ${school.name} (${school.email}) - ID: ${school.id}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSchools();