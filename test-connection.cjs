const { Pool } = require('pg');
require('dotenv').config({ path: './server/.env' });

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('\n✅ DATABASE CONNECTION SUCCESSFUL\n');
    
    const dbInfo = await client.query(`
      SELECT current_database() as database, 
             current_user as user,
             now() as timestamp
    `);
    
    console.log('📊 Database Info:');
    console.log(`   Database: ${dbInfo.rows[0].database}`);
    console.log(`   User: ${dbInfo.rows[0].user}`);
    console.log(`   Time: ${dbInfo.rows[0].timestamp}\n`);
    
    const tableCount = await client.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log(`📈 Tables in Database: ${tableCount.rows[0].count}\n`);
    
    const subscribedPlans = await client.query(`
      SELECT COUNT(*) as count FROM subscription_plans
    `);
    
    console.log(`📋 Subscription Plans Configured: ${subscribedPlans.rows[0].count}\n`);
    
    client.release();
    await pool.end();
    
    console.log('✅ All tests passed!\n');
  } catch (error) {
    console.error('\n❌ Connection Error:', error.message);
    console.error('Please check your DATABASE_URL in .env\n');
    process.exit(1);
  }
}

testConnection();
