const { query } = require('./db/connection');

async function checkAssignments() {
  try {
    const result = await query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'assignments' ORDER BY ordinal_position");
    console.log('Assignments table columns:');
    result.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type} (${row.is_nullable})`);
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkAssignments();