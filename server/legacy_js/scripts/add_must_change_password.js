const { query } = require('../db/connection');

async function addMustChangePasswordColumn() {
  try {
    console.log('Adding must_change_password column to users table...');
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true');
    console.log('✓ Column added successfully!');
  } catch (error) {
    console.error('Error adding column:', error);
    process.exit(1);
  }
}

addMustChangePasswordColumn();