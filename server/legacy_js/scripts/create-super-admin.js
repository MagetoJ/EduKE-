/**
 * Create Super Admin User
 * This script creates a super admin user for system management
 */

const bcrypt = require('bcrypt');
const { query } = require('../db/connection');
require('dotenv').config();

const SUPER_ADMIN = {
  email: process.env.SUPER_ADMIN_USERNAME || 'superadmin@eduke.com',
  password: process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin2024!',
  firstName: 'Super',
  lastName: 'Admin',
  name: 'Super Admin'
};

async function createSuperAdmin() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🔐 Creating Super Admin User');
    console.log('='.repeat(60));
    
    // Check if super admin already exists
    const existing = await query(
      'SELECT id, email FROM users WHERE email = $1',
      [SUPER_ADMIN.email]
    );
    
    if (existing.rows.length > 0) {
      console.log('⚠️  Super admin already exists!');
      console.log('\n📧 Email:', SUPER_ADMIN.email);
      console.log('🔑 Password: ' + '*'.repeat(SUPER_ADMIN.password.length));
      console.log('\nℹ️  You can use these credentials to login.');
      console.log('='.repeat(60) + '\n');
      process.exit(0);
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(SUPER_ADMIN.password, 10);
    
    // Create super admin user (no school_id for super admins)
    const result = await query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, name,
        role, status, is_verified, email_verified_at, school_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9)`,
      [
        SUPER_ADMIN.email,
        passwordHash,
        SUPER_ADMIN.firstName,
        SUPER_ADMIN.lastName,
        SUPER_ADMIN.name,
        'super_admin',
        'active',
        true,
        null
      ]
    );

    // Get the created user
    const userResult = await query(
      'SELECT id, email, first_name, last_name, role FROM users WHERE email = $1',
      [SUPER_ADMIN.email]
    );

    const user = userResult.rows[0];
    
    console.log('\n✅ Super Admin Created Successfully!\n');
    console.log('📋 User Details:');
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Name:', user.first_name, user.last_name);
    console.log('   Role:', user.role);
    
    console.log('\n🔑 Login Credentials:');
    console.log('   📧 Email:', SUPER_ADMIN.email);
    console.log('   🔐 Password:', SUPER_ADMIN.password);
    
    console.log('\n⚠️  IMPORTANT: Change this password after first login!');
    console.log('\n🚀 You can now login at: http://localhost:3001/api/auth/login');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error creating super admin:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

createSuperAdmin();
