const bcrypt = require('bcrypt');
const { Pool } = require('pg'); 
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, 
});

async function updatePasswords() {
  const targetSchoolId = 6;
  const defaultPassword = 'Machakos@2026';
  
  try {
    console.log(`Generating secure hash for default password...`);
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);

    console.log(`Updating passwords for users at school ID: ${targetSchoolId}...`);
    
    // Corrected query using the school_users mapping table
    const updateQuery = `
      UPDATE users 
      SET hashed_password = $1
      WHERE id IN (
        SELECT user_id 
        FROM school_users 
        WHERE school_id = $2
      )
      RETURNING id, email;
    `;
    
    const res = await pool.query(updateQuery, [hashedPassword, targetSchoolId]);
    
    console.log(`Successfully updated passwords for ${res.rowCount} users at Machakos Day Academy.`);
    
  } catch (err) {
    console.error('Error updating passwords:', err);
  } finally {
    await pool.end();
  }
}

updatePasswords();