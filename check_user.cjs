const { Pool } = require('pg');
require('dotenv').config({ path: './server/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function check() {
  try {
    const res = await pool.query('SELECT id, email, role, status FROM users WHERE email = $1', ['jabez@superadmin.com']);
    console.log('User found:', JSON.stringify(res.rows, null, 2));
    
    if (res.rows.length === 0) {
        console.log('User NOT found. Listing all users:');
        const all = await pool.query('SELECT email, role FROM users LIMIT 10');
        console.log(all.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
