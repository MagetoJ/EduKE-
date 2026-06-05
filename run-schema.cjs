const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const connectionString = 'postgresql://eduke_a48d_user:AYqCj7aqRzwNN4kdql2BvS1mhYB7zlnw@dpg-d54g2iu3jp1c7397vac0-a.oregon-postgres.render.com/eduke_a48d';

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  statement_timeout: 30000,
  query_timeout: 30000
});

async function runSchema() {
  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database');

    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    console.log('Running schema file...');
    await client.query(schema);
    console.log('✅ Schema executed successfully');

    client.release();
    await pool.end();

    console.log('✅ All done! Tables created.');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) console.error('Details:', error.detail);
    process.exit(1);
  }
}

runSchema();
