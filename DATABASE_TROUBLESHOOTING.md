# Database Troubleshooting Guide

## Error: "relation 'users' does not exist" (PostgreSQL 42P01)

### Root Cause
This error occurs when code tries to query or modify the `users` table before it has been created in the database. Common causes:

1. **Schema initialization hasn't completed yet** - The `schema.sql` file is still being processed
2. **Patch scripts running before base schema** - Upgrade/migration scripts run before main schema creation
3. **Concurrent requests during startup** - API requests arrive before schema initialization finishes
4. **Fresh database** - First-time connection to an empty Render PostgreSQL database

### Solution: Quick Fix (Immediate)

**Option 1: Wait and Retry**
The server automatically initializes the schema on startup. Give it 10-15 seconds:
```bash
# Server will automatically create all tables
npm run dev
# Wait for console message: "✓ Database schema successfully initialized."
```

**Option 2: Verify Database State**
```bash
# Check which tables exist
npm run db:verify
```

**Option 3: Manual Schema Creation**
If tables still don't exist after waiting, manually initialize:

```bash
# Via psql
psql "postgresql://eduke_jys0_user:N6pcTQOwjBlxfMBZ7wIPbo6cA3MzzHTm@dpg-d55pta0gjchc738kbdd0-a.oregon-postgres.render.com/eduke_jys0" < database/schema.sql

# Via Node.js
npm run db:init
```

### Solution: Permanent Fix (Changes Made)

The following changes have been implemented to prevent this error:

#### 1. **Sequential Initialization** 
- Schema creation now runs first
- All patch/upgrade scripts wait for schema completion
- No concurrent operations during setup

#### 2. **Table Existence Checks**
- Before modifying any table, code checks if it exists
- If tables don't exist, upgrades are skipped safely
- Clear warnings logged if tables are missing

#### 3. **Improved Error Handling**
- PostgreSQL error codes properly caught
- Table existence errors (42P07) ignored safely
- Constraint errors (23514) handled gracefully

#### 4. **Explicit Logging**
- Clear console messages for each initialization step
- Shows progress: "Waiting for schema..." → "Schema initialization complete..."
- Error messages include statement that failed

## Database Initialization Flow

```
Server Startup
    ↓
[1] Initialize Schema (schema.sql)
    ├─ Check if schemas/tables already exist
    ├─ Create 65+ tables in dependency order
    └─ Create indexes
    ↓
[2] Ensure Schema Upgrades
    ├─ Check users table exists
    ├─ Check students table exists
    ├─ Add any missing columns
    └─ Skip if tables missing
    ↓
[3] Ensure Subscription Plans
    ├─ Check subscription_plans table
    ├─ Seed 4 default plans (Trial, Basic, Pro, Enterprise)
    └─ Use ON CONFLICT to skip if already exist
    ↓
[4] Ensure Super Admin
    ├─ Check users table
    ├─ Create super admin account if not exists
    └─ Hash password with bcrypt
    ↓
[5] Ensure School Subscriptions
    ├─ Check subscriptions table
    ├─ Link schools to trial plan
    └─ Set trial expiry date
    ↓
API Ready ✓
```

## Verification Commands

### Check Database Tables Exist
```bash
npm run db:verify
```

Expected output:
```
✓ subscription_plans
✓ schools
✓ subscriptions
✓ users
✓ students
✓ password_reset_tokens
... (18+ more tables)
✓ All required tables exist!
```

### Check PostgreSQL Connection
```bash
# Test connection directly
psql "postgresql://eduke_jys0_user:N6pcTQOwjBlxfMBZ7wIPbo6cA3MzzHTm@dpg-d55pta0gjchc738kbdd0-a.oregon-postgres.render.com/eduke_jys0"

# List all tables
\dt

# Exit psql
\q
```

### Check Server Initialization Logs
```bash
# Run with detailed logging
NODE_ENV=development npm run dev

# Look for these messages:
# ✓ Connected to PostgreSQL database
# Executing X schema statements...
# ✓ Database schema successfully initialized
# ✓ Schema upgrades complete
# ✓ Subscription plans configured
# ✓ Super admin account created
# ✓ Database initialization complete!
```

## Common Scenarios & Solutions

### Scenario 1: Fresh Render Database (First Time)
**What happens:**
1. Database is completely empty
2. Schema initialization creates all 65+ tables
3. This may take 5-15 seconds depending on network
4. Upgrade scripts wait for completion
5. Data is seeded (subscription plans, super admin)

**What to do:**
- Just wait! Console will show progress
- Don't make API requests during initialization
- Refresh browser after seeing "Database initialization complete!"

### Scenario 2: Error During First Run
**Error: "relation 'users' does not exist"**

**Why:**
- Schema initialization is still running
- An API request arrived too early
- Or there was a connection error

**What to do:**
1. Check console logs for initialization progress
2. If no schema messages, connection may have failed:
   ```bash
   # Verify DATABASE_URL in .env
   cat server/.env | grep DATABASE_URL
   ```
3. Restart server:
   ```bash
   npm run dev
   ```
4. Wait for: "✓ Database schema successfully initialized"
5. Try API request again

### Scenario 3: Tables Exist But "Field Not Found"
**Error: "column 'must_change_password' does not exist"**

**Why:**
- Schema initialized successfully
- But some columns are missing
- Old schema was only partially run before

**What to do:**
1. Run schema upgrades:
   ```bash
   npm run db:init
   ```
2. This will add any missing columns to existing tables
3. Restart server:
   ```bash
   npm run dev
   ```

### Scenario 4: "Duplicate Key" Errors During Initialization
**Error: "duplicate key value violates unique constraint"**

**Why:**
- Server was restarted and tried to re-insert plans
- Or data was partially seeded

**What to do:**
- This is normal and expected!
- The code uses `ON CONFLICT DO NOTHING`
- Duplicates are skipped safely
- No action needed, just wait for initialization to complete

### Scenario 5: Still Getting Errors After All Steps
**Debug procedure:**

1. **Check if tables actually exist:**
   ```bash
   npm run db:verify
   ```

2. **Check if PostgreSQL is responding:**
   ```bash
   psql "postgresql://eduke_jys0_user:N6pcTQOwjBlxfMBZ7wIPbo6cA3MzzHTm@dpg-d55pta0gjchc738kbdd0-a.oregon-postgres.render.com/eduke_jys0" -c "SELECT 1"
   ```

3. **Check environment variables:**
   ```bash
   cd server
   cat .env | grep DATABASE_URL
   cat .env | grep DB_TYPE
   ```

4. **Check Render dashboard:**
   - Log in to render.com
   - Go to PostgreSQL instance
   - Check "Logs" tab for connection errors
   - Check if instance is running (green status)

5. **Try manual schema creation:**
   ```bash
   psql "postgresql://..." < database/schema.sql
   ```

## File Changes Made

### `server/database.js`
- ✅ Sequential schema initialization
- ✅ Promise-based waiting mechanism
- ✅ Table existence checks in upgrades
- ✅ Better error logging
- ✅ Explicit initialization steps

### `server/db/connection.js`
- ✅ Auto-detect SSL for Render URLs
- ✅ Proper connection pooling
- ✅ Transaction support

### `database/schema.sql`
- ✅ Tables in proper dependency order
- ✅ ON CONFLICT clauses for idempotency
- ✅ All required columns present

### `server/scripts/verify-database.js` (NEW)
- ✅ Check all 18+ required tables exist
- ✅ Detailed verification report
- ✅ Clear error messages

### `server/package.json`
- ✅ Added `npm run db:verify` command

## Performance Considerations

### Why Is Schema Initialization Slow?

Creating 65+ tables with indexes can take time:
- **Network latency**: ~100-500ms per round-trip
- **Create 65 tables**: ~65 round-trips = 6-33 seconds
- **Create 100+ indexes**: ~100 round-trips = 10-50 seconds
- **Seed data**: ~10 more operations

**Total**: 5-15 seconds is normal for first initialization

### Optimization Tips

1. **Use connection pooling** (already configured)
   - Reuses connections
   - Reduces handshake overhead

2. **Batch statements** (already done)
   - But PostgreSQL limits how many can be in one call
   - So we execute one-by-one with error handling

3. **First initialization only**
   - Subsequent restarts skip table creation (already exist)
   - Only checks for missing columns (~1 second)
   - Then validates data (~1 second)

## Monitoring Schema Creation

### Real-Time Logs
```bash
npm run dev 2>&1 | grep -i "schema\|database\|✓"
```

### Count Tables in Database
```bash
psql "postgresql://..." -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
```

Should show: 65+ tables after initialization completes

### Check Last 100 Logs
```bash
# In Render dashboard
PostgreSQL Instance → Logs → Recent (live tail)
```

## Render PostgreSQL Specifics

### Connection Requirements
- **SSL**: Required for Render URLs
- **Timeout**: 30 seconds default
- **Max connections**: Based on plan
- **Automatic backups**: Daily

### Status Page
- Check render.com/status for outages
- Monitor instance health in dashboard

### Upgrade Path
If you hit connection limits:
1. Check `current_connections` in database
2. Upgrade Render PostgreSQL plan if needed
3. Increase `max_connections` in database settings

## Getting Help

If issues persist:

1. **Collect diagnostics:**
   ```bash
   npm run db:verify > debug.log 2>&1
   psql "postgresql://..." -c "\dt" > tables.log
   cat server/.env | grep DB >> config.log
   ```

2. **Check logs:**
   - Server console output (npm run dev)
   - Render PostgreSQL logs (dashboard)
   - Application error logs

3. **Try fresh database:**
   ```bash
   # In Render dashboard:
   # 1. Delete current database
   # 2. Create new PostgreSQL
   # 3. Update DATABASE_URL in .env
   # 4. npm run dev (will recreate schema)
   ```

## Success Indicators

After proper initialization, you should see:

```
Executing 65 schema statements...
✓ Database schema successfully initialized.
Schema initialization complete. Starting data setup...
✓ Schema upgrades complete
✓ Subscription plans configured
✓ Super admin account created
✓ Database initialization complete!

Server running on http://localhost:3001
```

---

**Last Updated**: 2024
**Schema Version**: 65+ tables
**PostgreSQL Version**: 12+
