require('dotenv').config();
const { Pool } = require('pg');

const getDbConfig = () => {
  const useProduction = process.env.USE_PRODUCTION_DB === 'true';

  if (useProduction) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
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

const leaveTypes = [
  { name: 'Annual Leave', description: 'Annual vacation leave', max_days_per_year: 21, requires_approval: true },
  { name: 'Sick Leave', description: 'Leave due to illness', max_days_per_year: 10, requires_approval: true },
  { name: 'Maternity Leave', description: 'Maternity leave for female employees', max_days_per_year: 90, requires_approval: true },
  { name: 'Paternity Leave', description: 'Paternity leave for male employees', max_days_per_year: 14, requires_approval: true },
  { name: 'Compassionate Leave', description: 'Leave due to family emergencies', max_days_per_year: 5, requires_approval: true },
  { name: 'Study Leave', description: 'Leave for professional development', max_days_per_year: 10, requires_approval: true }
];

async function insertLeaveTypes() {
  try {
    console.log('Connecting to database...');
    
    // Get all schools
    const schoolsResult = await pool.query('SELECT id FROM schools ORDER BY id');
    const schools = schoolsResult.rows;

    if (schools.length === 0) {
      console.log('No schools found in the database.');
      process.exit(1);
    }

    console.log(`Found ${schools.length} school(s)`);

    for (const school of schools) {
      const schoolId = school.id;
      console.log(`\nInserting leave types for school ID ${schoolId}...`);

      for (const leaveType of leaveTypes) {
        try {
          const result = await pool.query(
            `INSERT INTO leave_types (school_id, name, description, max_days_per_year, requires_approval, is_active, created_at)
             VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP)
             RETURNING id, name;`,
            [schoolId, leaveType.name, leaveType.description, leaveType.max_days_per_year, leaveType.requires_approval]
          );
          console.log(`  ✓ Created: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
        } catch (error) {
          if (error.code === '23505') {
            console.log(`  ⚠ Already exists: ${leaveType.name}`);
          } else {
            console.error(`  ✗ Error creating ${leaveType.name}:`, error.message);
          }
        }
      }
    }

    console.log('\n✓ Leave types insertion completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

insertLeaveTypes();
