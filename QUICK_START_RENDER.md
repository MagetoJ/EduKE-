# Quick Start - Render PostgreSQL Setup

## Step 1: Configure Environment

Create or update `.env` file in the `server/` directory with:

```env
# Environment
NODE_ENV=development
DB_TYPE=postgres

# Server Configuration
PORT=3001
FRONTEND_URL=http://localhost:5173

# Render PostgreSQL Database
DATABASE_URL=postgresql://eduke_jys0_user:N6pcTQOwjBlxfMBZ7wIPbo6cA3MzzHTm@dpg-d55pta0gjchc738kbdd0-a.oregon-postgres.render.com/eduke_jys0

# Super Admin Account (auto-created on first run)
SUPER_ADMIN_USERNAME=jabez@superadmin.com
SUPER_ADMIN_PASSWORD=lokeshen@58

# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

## Step 2: Install Dependencies

```bash
cd server
npm install
```

## Step 3: Start the Server

The server will automatically:
1. ✅ Connect to Render PostgreSQL
2. ✅ Create all 65+ required tables
3. ✅ Seed subscription plans (Trial, Basic, Pro, Enterprise)
4. ✅ Create super admin account
5. ✅ Set up schema indexes

```bash
npm run dev
# or for production
npm start
```

## Step 4: Verify Connection

You should see in console:
```
Connected to PostgreSQL database.
Database schema ensured.
```

## Step 5: Login

Access the application and login with:
- **Email**: `jabez@superadmin.com`
- **Password**: `lokeshen@58`

## Database Details

**Connection String:**
```
postgresql://eduke_jys0_user:N6pcTQOwjBlxfMBZ7wIPbo6cA3MzzHTm@dpg-d55pta0gjchc738kbdd0-a.oregon-postgres.render.com/eduke_jys0
```

**Database Name:** `eduke_jys0`
**User:** `eduke_jys0_user`

## Tables Created (Sample)

- **Authentication**: users, refresh_tokens, password_reset_tokens
- **Core**: schools, subscriptions, subscription_plans
- **Academic**: students, courses, academic_years, terms
- **Assignments**: assignments, submissions, performance
- **Management**: leave_types, leave_requests, activity_logs
- And 50+ more tables for full functionality

## What Happens on First Run

1. **Schema Initialization**: All tables created automatically
2. **Subscription Plans**: 4 plans inserted (Trial, Basic, Pro, Enterprise)
3. **Super Admin**: Account created with provided credentials
4. **Schema Upgrades**: Any missing columns added
5. **Indexes**: All performance indexes created

## Troubleshooting

### Can't connect to database?
- Verify DATABASE_URL in `.env`
- Check Render PostgreSQL instance is running
- Ensure credentials are correct

### Tables already exist?
- That's fine! The code uses `CREATE TABLE IF NOT EXISTS`
- Existing data is preserved
- You can safely restart the server

### Can't login?
- Check super admin credentials in console output
- Verify user was created (check database)
- Reset password through email verification link

## Dashboard Access

Once running, access:
- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:3001`

## Next Steps

1. ✅ Update super admin password for security
2. ✅ Configure email settings (optional)
3. ✅ Set up schools and users
4. ✅ Start managing students and curriculum
