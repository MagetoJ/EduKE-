# EduKE Database Setup Guide

## Overview
EduKE uses PostgreSQL for both production (Render) and local development. This guide will help you set up and manage your databases.

## Database Architecture
- **Production**: Hosted on Render.com
- **Local**: PostgreSQL on your machine
- **Tables**: 30+ tables for complete school management
- **Multi-tenant**: Isolated data per school using `school_id`

---

## Quick Start

### 1. Production Database (Already Initialized)
✅ Your production database on Render has been initialized with:
- All 30+ tables created
- Indexes and constraints set up
- 4 subscription plans seeded
- Ready to use!

**Connection String:**
```
postgresql://eduke_user:***@dpg-d4b2seadbo4c73e8qfl0-a.oregon-postgres.render.com/eduke
```

### 2. Local PostgreSQL Setup

#### Option A: Install PostgreSQL (Recommended)

**Windows:**
1. Download from: https://www.postgresql.org/download/windows/
2. Run installer (keep default port 5432)
3. Set password for postgres user
4. Add to PATH (installer usually does this)

**Verify Installation:**
```bash
psql --version
```

**Create Local Database:**
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE eduke_local;

# Exit
\q
```

#### Option B: Use Docker
```bash
docker run --name eduke-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=eduke_local \
  -p 5432:5432 \
  -d postgres:15
```

### 3. Configure Environment

Update `server/.env`:
```env
# Use production (Render)
USE_PRODUCTION_DB=true

# OR use local database
USE_PRODUCTION_DB=false
DB_HOST=localhost
DB_PORT=5432
DB_NAME=eduke_local
DB_USER=postgres
DB_PASSWORD=your_password
```

### 4. Initialize Local Database

```bash
cd server
npm run db:init
```

This will:
- Connect to your local PostgreSQL
- Create all tables
- Set up indexes
- Seed subscription plans

---

## Available Scripts

From the `server` directory:

```bash
# Initialize local database
npm run db:init

# Initialize production database
npm run db:init:prod

# Reset local database (drops all tables and recreates)
npm run db:reset

# Reset production database (USE WITH CAUTION!)
npm run db:reset:prod

# Start server
npm start

# Start server in development mode
npm run dev
```

---

## Database Schema

### Core Tables (30+)

1. **Global Tables** (no school_id)
   - `subscription_plans` - Pricing plans with features

2. **School Management**
   - `schools` - Tenant/school information
   - `subscriptions` - School subscription tracking

3. **User Management**
   - `users` - All system users (admins, teachers, parents, students)
   - `password_reset_tokens`
   - `email_verification_tokens`
   - `refresh_tokens`

4. **Student Management**
   - `students` - Student profiles
   - `parent_student_relations` - Link parents to students

5. **Academic**
   - `academic_years` - School years
   - `terms` - Terms/semesters
   - `courses` - Subjects/classes
   - `course_enrollments` - Student enrollments
   - `course_resources` - Course materials

6. **Assignments**
   - `assignments` - Homework, projects, etc.
   - `assignment_submissions` - Student submissions

7. **Examinations**
   - `exams` - Exam schedules
   - `exam_results` - Student exam scores

8. **Attendance**
   - `attendance` - Daily attendance records

9. **Performance**
   - `performance` - Grade records
   - `report_cards` - Term reports

10. **Discipline**
    - `discipline` - Incident reports

11. **Fees**
    - `fee_structures` - Fee types
    - `student_fees` - Assigned fees
    - `fee_payments` - Payment records

12. **Communications**
    - `messages` - Announcements/messages
    - `message_recipients` - Read status
    - `notifications` - User notifications

13. **Timetable**
    - `timetable_periods` - School periods
    - `timetable_entries` - Class schedules

14. **Leave Management**
    - `leave_types` - Leave categories
    - `leave_requests` - Staff leave requests

15. **Audit**
    - `activity_logs` - System audit trail

---

## Switching Between Databases

### Use Production Database
```env
# In server/.env
USE_PRODUCTION_DB=true
```

### Use Local Database
```env
# In server/.env
USE_PRODUCTION_DB=false
DB_HOST=localhost
DB_NAME=eduke_local
DB_USER=postgres
DB_PASSWORD=your_password
```

---

## Seeded Data

### Subscription Plans

The database includes 4 pre-configured plans:

1. **Trial Plan** - Free 14-day trial
   - 50 students, 10 staff
   - Basic features only

2. **Basic Plan** - $49.99/month
   - 100 students, 20 staff
   - Parent/Student portals
   - Messaging & Finance

3. **Professional Plan** - $99.99/month
   - 500 students, 50 staff
   - All Basic features +
   - Advanced reports
   - Leave management

4. **Enterprise Plan** - $199.99/month
   - Unlimited students & staff
   - All Professional features +
   - AI Analytics

---

## Common Issues & Solutions

### Issue: Can't connect to local database
**Solution:**
```bash
# Check if PostgreSQL is running
# Windows:
services.msc  # Look for PostgreSQL service

# Or restart PostgreSQL
pg_ctl restart
```

### Issue: "database does not exist"
**Solution:**
```bash
psql -U postgres
CREATE DATABASE eduke_local;
\q
npm run db:init
```

### Issue: Permission denied
**Solution:**
```bash
# Grant permissions to user
psql -U postgres
GRANT ALL PRIVILEGES ON DATABASE eduke_local TO postgres;
\q
```

### Issue: SSL connection error
**Solution:**
For local development, SSL is not required. For production (Render), SSL is handled automatically.

---

## Database Backup

### Backup Production Database
```bash
# Using environment variable
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Or with connection string
pg_dump "postgresql://eduke_user:***@dpg-d4b2seadbo4c73e8qfl0-a.oregon-postgres.render.com/eduke" > backup.sql
```

### Backup Local Database
```bash
pg_dump -U postgres eduke_local > backup_local.sql
```

### Restore from Backup
```bash
psql -U postgres eduke_local < backup_local.sql
```

---

## Next Steps

1. ✅ Production database initialized
2. 📝 Set up local PostgreSQL (if needed)
3. 🔧 Initialize local database with `npm run db:init`
4. 🚀 Start the server with `npm start`
5. 🧪 Test API endpoints
6. 📊 Create your first school via API

---

## API Integration

The database is now ready. The server will automatically:
- Connect to the appropriate database (production/local)
- Handle multi-tenant queries with `school_id` isolation
- Manage connection pooling
- Log query performance

Check `server/db/connection.js` for database utilities:
- `query(text, params)` - Execute SQL queries
- `transaction(callback)` - Run transactional operations
- `getDatabaseInfo()` - Get current database info

---

## Support

For issues or questions:
1. Check the error logs in terminal
2. Verify database connection settings in `.env`
3. Ensure PostgreSQL is running
4. Check the schema file for table structures

Database Status: ✅ **Ready for Development**
