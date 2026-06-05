const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

const log = (message, color = colors.reset) => {
  console.log(`${color}${message}${colors.reset}`);
};

const isProductionEnv = process.argv.includes('--production')
  || process.env.NODE_ENV === 'production'
  || process.env.RENDER === 'true'
  || process.env.RENDER === '1'
  || process.env.RAILWAY_ENVIRONMENT
  || Boolean(process.env.DATABASE_URL);

const prefersSQLite = process.argv.includes('--sqlite')
  || (process.env.DB_TYPE || '').toLowerCase() === 'sqlite'
  || (process.env.DB_TYPE || '').toLowerCase() === 'sqlite3'
  || (process.env.USE_SQLITE || '').toLowerCase() === 'true'
  || (process.env.USE_SQLITE || '').toLowerCase() === '1';

const hasPostgresConfig = Boolean(
  process.env.DATABASE_URL
    || process.env.DB_HOST
    || process.env.DB_NAME
    || process.env.DB_USER
    || process.env.DB_PASSWORD
);

const useSQLite = !isProductionEnv && (prefersSQLite || !hasPostgresConfig);

if (isProductionEnv && prefersSQLite) {
  log('\n⚠️  SQLite is disabled in production. Using PostgreSQL instead.', colors.yellow);
}

const getDbConfig = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    };
  }

  if (!hasPostgresConfig) {
    throw new Error('PostgreSQL configuration is required. Set DATABASE_URL or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD.');
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'eduke_local',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  };
};

async function initializeDatabase() {
  let db;
  if (useSQLite) {
    log('\n💻 Using LOCAL SQLite database', colors.cyan);
    const dbPath = path.join(__dirname, '..', 'eduke.db');
    db = new sqlite3.Database(dbPath);
    log('\n📊 Opening SQLite database...', colors.cyan);
    log('✓ SQLite database opened successfully!', colors.green);
  } else {
    log('\n🌐 Using PostgreSQL database', colors.yellow);
    db = new Pool(getDbConfig());
    log('\n📊 Connecting to database...', colors.cyan);
    await db.query('SELECT NOW()');
    log('✓ Connected successfully!', colors.green);
  }

  try {
    const schemaPath = useSQLite
      ? path.join(__dirname, '../../database/schema_sqlite.sql')
      : path.join(__dirname, '../../database/schema.sql');
    log('\n📄 Reading schema file...', colors.cyan);
    const schema = fs.readFileSync(schemaPath, 'utf8');
    log('✓ Schema file loaded', colors.green);

    log('\n🔨 Creating tables and indexes...', colors.cyan);
    if (useSQLite) {
      const statements = schema.split(';').filter(stmt => stmt.trim());
      for (const statement of statements) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        await new Promise((resolve, reject) => {
          db.run(trimmed, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    } else {
      await db.query(schema);
    }
    log('✓ Database schema created successfully!', colors.green);
    
    let tablesResult;
    if (useSQLite) {
      tablesResult = await new Promise((resolve, reject) => {
        db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, rows) => {
          if (err) reject(err);
          else resolve({ rows });
        });
      });
      log(`\n✓ Created ${tablesResult.rows.length} tables:`, colors.green);
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.name}`);
      });
    } else {
      tablesResult = await db.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      log(`\n✓ Created ${tablesResult.rows.length} tables:`, colors.green);
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    }

    let plansResult;
    if (useSQLite) {
      plansResult = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM subscription_plans', (err, rows) => {
          if (err) reject(err);
          else resolve({ rows });
        });
      });
      log(`\n✓ Seeded ${plansResult.rows.length} subscription plans`, colors.green);
    } else {
      plansResult = await db.query('SELECT * FROM subscription_plans');
      log(`\n✓ Seeded ${plansResult.rows.length} subscription plans`, colors.green);
    }
    
    log('\n🎉 Database initialization completed successfully!', colors.bright + colors.green);
    log('\nYou can now start the server with: npm start\n', colors.cyan);
    
  } catch (error) {
    log('\n❌ Error initializing database:', colors.red);
    console.error(error);
    process.exit(1);
  } finally {
    if (useSQLite && db) {
      db.close();
    } else if (!useSQLite && db) {
      await db.end();
    }
  }
}

log('\n' + '='.repeat(60), colors.bright);
log('  EduKE Database Initialization', colors.bright + colors.cyan);
log('='.repeat(60) + '\n', colors.bright);

initializeDatabase().catch(err => {
  log('\n❌ Fatal error:', colors.red);
  console.error(err);
  process.exit(1);
});
