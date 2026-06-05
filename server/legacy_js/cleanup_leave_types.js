require('dotenv').config();
const { Pool } = require('pg');

const getDbConfig = () => {
  const useProduction = process.env.USE_PRODUCTION_DB === 'true';
  if (useProduction) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'eduke',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  };
};

const pool = new Pool(getDbConfig());

async function cleanupDuplicates() {
  try {
    console.log('Finding duplicate leave types...\n');
    
    const duplicates = await pool.query(`
      SELECT school_id, name, COUNT(*) as count, array_agg(id ORDER BY id) as ids
      FROM leave_types
      GROUP BY school_id, name
      HAVING COUNT(*) > 1
      ORDER BY school_id, name
    `);

    if (duplicates.rows.length === 0) {
      console.log('No duplicate leave types found!');
      pool.end();
      return;
    }

    console.log(`Found ${duplicates.rows.length} duplicate entries:\n`);

    let deletedCount = 0;

    for (const row of duplicates.rows) {
      const idsToDelete = row.ids.slice(0, -1);
      console.log(`School ${row.school_id} - ${row.name}:`);
      console.log(`  Keeping ID: ${row.ids[row.ids.length - 1]} (newest)`);
      console.log(`  Deleting IDs: ${idsToDelete.join(', ')}`);

      const deleteResult = await pool.query(
        'DELETE FROM leave_types WHERE id = ANY($1)',
        [idsToDelete]
      );
      
      deletedCount += deleteResult.rowCount;
      console.log(`  ✓ Deleted ${deleteResult.rowCount} old entries\n`);
    }

    console.log(`Total deleted: ${deletedCount} old leave type entries`);
    console.log('\n✓ Cleanup completed successfully!');
    
    pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

cleanupDuplicates();
