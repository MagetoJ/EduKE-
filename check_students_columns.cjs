require('dotenv').config({ path: './server/.env' });
const { dbAll } = require('./server/database');

async function checkColumns() {
  try {
    console.log('Checking students table columns...');

    // Get column names from information_schema
    const columns = await dbAll(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'students' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    console.log('Students table columns:');
    columns.forEach(col => {
      console.log(`- ${col.column_name}`);
    });

  } catch (e) {
    console.error('Error:', e.message);
  }
}

checkColumns();