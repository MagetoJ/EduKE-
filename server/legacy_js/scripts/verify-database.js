#!/usr/bin/env node

/**
 * Database Verification Script
 * Verifies that all required tables exist in the database
 * Usage: node scripts/verify-database.js
 */

require('dotenv').config();

const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.DATABASE_URL);
const dbType = (process.env.DB_TYPE || '').toLowerCase();
const prefersSQLite = dbType === 'sqlite' || dbType === 'sqlite3';
const useSQLite = !isProduction && prefersSQLite;

const requiredTables = [
  'subscription_plans',
  'schools',
  'subscriptions',
  'users',
  'students',
  'password_reset_tokens',
  'email_verification_tokens',
  'refresh_tokens',
  'academic_years',
  'terms',
  'courses',
  'course_enrollments',
  'assignments',
  'performance',
  'attendance',
  'leave_types',
  'leave_requests',
  'activity_logs'
];

const getDbConnection = () => {
  if (useSQLite) {
    const dbPath = path.join(__dirname, '..', 'eduke.db');
    return new sqlite3.Database(dbPath);
  } else {
    const config = process.env.DATABASE_URL ? 
      { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } } :
      {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'eduke_jys0',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres'
      };
    return new Pool(config);
  }
};

const checkTables = async () => {
  const db = getDbConnection();
  
  console.log('\n📊 Database Verification');
  console.log('========================\n');
  
  if (!useSQLite) {
    console.log(`Database Type: PostgreSQL`);
    console.log(`Connection: ${process.env.DATABASE_URL ? 'Render (URL)' : 'Local/Env'}\n`);
  } else {
    console.log(`Database Type: SQLite`);
    console.log(`Path: server/eduke.db\n`);
  }

  const results = {
    existing: [],
    missing: [],
    errors: []
  };

  for (const tableName of requiredTables) {
    try {
      let exists = false;
      
      if (useSQLite) {
        const result = await new Promise((resolve, reject) => {
          db.all(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
            [tableName],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows && rows.length > 0);
            }
          );
        });
        exists = result;
      } else {
        const result = await db.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )`,
          [tableName]
        );
        exists = !!result.rows[0]?.exists;
      }

      if (exists) {
        results.existing.push(tableName);
        console.log(`✓ ${tableName}`);
      } else {
        results.missing.push(tableName);
        console.log(`✗ ${tableName} (MISSING)`);
      }
    } catch (error) {
      results.errors.push({ table: tableName, error: error.message });
      console.log(`⚠ ${tableName} (ERROR: ${error.message})`);
    }
  }

  console.log('\n📈 Summary');
  console.log('----------');
  console.log(`✓ Existing: ${results.existing.length}/${requiredTables.length}`);
  console.log(`✗ Missing: ${results.missing.length}/${requiredTables.length}`);
  
  if (results.errors.length > 0) {
    console.log(`⚠ Errors: ${results.errors.length}`);
  }

  if (results.missing.length > 0) {
    console.log('\n⚠ Missing Tables:');
    results.missing.forEach(t => console.log(`  - ${t}`));
    console.log('\n💡 Solution:');
    console.log('   The schema initialization may still be running.');
    console.log('   Please wait a few seconds and try again.');
    console.log('   Or restart the server to trigger schema creation.');
  }

  if (results.errors.length > 0) {
    console.log('\n❌ Errors Occurred:');
    results.errors.forEach(e => console.log(`  - ${e.table}: ${e.error}`));
  }

  if (results.missing.length === 0 && results.errors.length === 0) {
    console.log('\n✅ All required tables exist!');
  }

  console.log('\n');

  // Close database connections
  if (useSQLite) {
    db.close();
  } else {
    await db.end();
  }

  process.exit(results.missing.length > 0 || results.errors.length > 0 ? 1 : 0);
};

checkTables().catch((error) => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
