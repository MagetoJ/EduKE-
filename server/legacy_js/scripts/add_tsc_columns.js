const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false,
});

async function addTSCColumns() {
  const client = await pool.connect();
  try {
    console.log('Adding TSC compliance columns to users table...');

    const queries = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS tsc_number VARCHAR(50)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS tpad_deadline DATE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS tpad_submitted BOOLEAN DEFAULT FALSE`,
      `CREATE INDEX IF NOT EXISTS idx_user_tsc ON users(tsc_number)`,
      `CREATE INDEX IF NOT EXISTS idx_user_tpad ON users(tpad_deadline)`
    ];

    for (const query of queries) {
      await client.query(query);
      console.log(`✓ Executed: ${query.substring(0, 50)}...`);
    }

    console.log('✓ TSC compliance columns added successfully!');
  } catch (err) {
    console.error('Error adding TSC columns:', err);
    throw err;
  } finally {
    await client.release();
    await pool.end();
  }
}

addTSCColumns();
