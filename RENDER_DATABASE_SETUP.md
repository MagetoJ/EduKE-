# Render PostgreSQL Database Setup

## Database Connection

**Database URL:**
```
postgresql://eduke_jys0_user:N6pcTQOwjBlxfMBZ7wIPbo6cA3MzzHTm@dpg-d55pta0gjchc738kbdd0-a.oregon-postgres.render.com/eduke_jys0
```

## Configuration

The system is now configured to use this Render PostgreSQL database. Update your `.env` file:

```
NODE_ENV=development
DB_TYPE=postgres
DATABASE_URL=postgresql://eduke_jys0_user:N6pcTQOwjBlxfMBZ7wIPbo6cA3MzzHTm@dpg-d55pta0gjchc738kbdd0-a.oregon-postgres.render.com/eduke_jys0
PORT=3001
FRONTEND_URL=http://localhost:5173
```

## Automatic Initialization

When you start the server (`npm run dev` or `npm start`), the system will:

1. **Automatically create all required tables** from `database/schema.sql`
2. **Handle duplicate tables gracefully** (skips if tables already exist)
3. **Seed subscription plans** with Trial, Basic, Pro, and Enterprise plans
4. **Create a Super Admin account** using credentials from `config.js`

## Manual Database Initialization (Optional)

If you need to manually initialize the database, you can use the Render PostgreSQL console:

### Via Render Dashboard:
1. Go to Render.com Dashboard
2. Select your PostgreSQL instance (eduke_jys0)
3. Click "Connect" → "psql"
4. Copy and paste the full schema from `database/schema.sql`

### Via Command Line (psql):
```bash
psql "postgresql://eduke_jys0_user:N6pcTQOwjBlxfMBZ7wIPbo6cA3MzzHTm@dpg-d55pta0gjchc738kbdd0-a.oregon-postgres.render.com/eduke_jys0" < database/schema.sql
```

## Troubleshooting

### Connection Refused
- Verify DATABASE_URL is correctly set in `.env`
- Check if Render PostgreSQL instance is running (Render Dashboard)
- Ensure SSL mode is set to `require` (handled automatically)

### Table Already Exists
- The schema uses `CREATE TABLE IF NOT EXISTS`, so re-running is safe
- Existing data will not be affected

### Permission Errors
- Verify the database user has proper permissions
- Default user `eduke_jys0_user` should have full access to `eduke_jys0` database

## Tables Created

The schema includes 65+ tables covering:
- **Authentication**: users, password_reset_tokens, email_verification_tokens, refresh_tokens
- **Tenants**: schools, subscriptions, subscription_plans
- **Academic**: students, courses, academic_years, terms, course_enrollments
- **Assignments**: assignments, submissions, performance
- **Attendance**: attendance, gradebook
- **Finance**: student_fees, fee_structures, invoices, payments
- **Messaging**: messages, notifications
- **Leave Management**: leave_types, leave_requests
- **Infrastructure**: timetable_periods, timetable_entries, classrooms
- **Audit**: activity_logs

## Data Migration

If you have existing data from another database:

1. Export data from old database
2. Transform to match PostgreSQL schema
3. Import into Render PostgreSQL
4. Verify data integrity

## Backup

Render PostgreSQL includes automatic backups. To manually backup:

```bash
pg_dump "postgresql://eduke_jys0_user:N6pcTQOwjBlxfMBZ7wIPbo6cA3MzzHTm@dpg-d55pta0gjchc738kbdd0-a.oregon-postgres.render.com/eduke_jys0" > eduke_backup.sql
```

To restore:

```bash
psql "postgresql://eduke_jys0_user:N6pcTQOwjBlxfMBZ7wIPbo6cA3MzzHTm@dpg-d55pta0gjchc738kbdd0-a.oregon-postgres.render.com/eduke_jys0" < eduke_backup.sql
```
