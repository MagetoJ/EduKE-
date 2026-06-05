require('dotenv').config();
const { dbAll } = require('./database');

async function check() {
  try {
    const columns = await dbAll(`SELECT column_name FROM information_schema.columns WHERE table_name = 'students' AND table_schema = 'public' ORDER BY ordinal_position`);
    console.log('Students table columns:');
    columns.forEach(col => console.log(`- ${col.column_name}`));

    // Check if class_assigned column exists
    const hasClassAssigned = columns.some(col => col.column_name === 'class_assigned');
    console.log(`Has class_assigned column: ${hasClassAssigned}`);

    // Check if class_section column exists
    const hasClassSection = columns.some(col => col.column_name === 'class_section');
    console.log(`Has class_section column: ${hasClassSection}`);
  } catch (e) { console.error(e.message); }
}

check();