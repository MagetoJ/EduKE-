const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

const SALT_ROUNDS = 10;

// Super admin credentials
const SUPER_ADMIN_EMAIL = 'superadmin@eduke.io';
const SUPER_ADMIN_PASSWORD = 'SuperAdmin@2025';
const SUPER_ADMIN_NAME = 'Super Admin';

async function createSuperAdmin() {
  // Determine which database to use
  const useProduction = process.env.USE_PRODUCTION_DB === 'true' || !!process.env.DATABASE_URL;
  
  const poolConfig = useProduction && process.env.DATABASE_URL 
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'eduke_local',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres'
      };

  const pool = new Pool(poolConfig);

  try {
    console.log('Connecting to database...');
    
    // Check if super admin already exists
    const checkResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [SUPER_ADMIN_EMAIL]
    );

    if (checkResult.rows.length > 0) {
      console.log('✗ Super admin already exists with email:', SUPER_ADMIN_EMAIL);
      process.exit(1);
    }

    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, SALT_ROUNDS);

    console.log('Creating super admin user...');
    const result = await pool.query(
      `INSERT INTO users (
        email, password_hash, name, role, status, is_verified, school_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, name, role, status`,
      [
        SUPER_ADMIN_EMAIL,
        passwordHash,
        SUPER_ADMIN_NAME,
        'super_admin',
        'active',
        true,
        null
      ]
    );

    const user = result.rows[0];
    
    console.log('\n✓ Super admin created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('LOGIN DETAILS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:    ${SUPER_ADMIN_EMAIL}`);
    console.log(`Password: ${SUPER_ADMIN_PASSWORD}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('User Details:');
    console.log(`  ID:     ${user.id}`);
    console.log(`  Name:   ${user.name}`);
    console.log(`  Role:   ${user.role}`);
    console.log(`  Status: ${user.status}`);
    console.log('');

  } catch (error) {
    console.error('Error creating super admin:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createSuperAdmin();
