const { Pool } = require('pg');

const connectionString = 'postgresql://eduke_a48d_user:AYqCj7aqRzwNN4kdql2BvS1mhYB7zlnw@dpg-d54g2iu3jp1c7397vac0-a.oregon-postgres.render.com/eduke_a48d';

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function verifySchema() {
  try {
    const client = await pool.connect();
    
    const result = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`
    );
    
    console.log('\n📊 Tables Created in Database:\n');
    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.table_name}`);
    });
    
    console.log(`\n✅ Total Tables: ${result.rows.length}\n`);
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifySchema();
