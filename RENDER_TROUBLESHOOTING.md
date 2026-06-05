# Render Deployment - Troubleshooting Guide

---

## Deployment Issues

### Build Fails - "Command failed"

**Problem**: Deployment fails during build step

**Check logs**:
1. Dashboard → Service → Logs
2. Look for error message
3. Scroll to see full error

**Common causes**:

```
❌ "npm ERR! code ERESOLVE"
→ Dependency conflict
→ Solution: Check package.json for version conflicts
→ Run: npm install --legacy-peer-deps (last resort)

❌ "No build script"
→ buildCommand is wrong
→ Solution: Check render.yaml buildCommand matches your package.json

❌ "Module not found"
→ Missing dependency
→ Solution: Add to package.json, commit, redeploy

❌ "TypeScript error"
→ Build fails due to TypeScript
→ Solution: Fix errors locally, test with: npm run build
```

**Solution steps**:

1. Fix issue locally
2. Test: `npm install && npm run build`
3. Commit changes
4. Push to GitHub
5. Render auto-redeploys
6. Check logs: Dashboard → Logs

---

## Environment Variable Issues

### Secrets Not Working - "Undefined secret"

**Problem**: Environment variables not found in logs

**Check**:
1. Dashboard → Service → Environment
2. Verify all required variables exist
3. Check spelling (case-sensitive!)

**Common issues**:

```
❌ JWT_SECRET missing
→ Restart service after adding
→ Check it's in Environment tab

❌ DATABASE_URL not auto-populated
→ PostgreSQL service not deployed yet
→ Wait 2-3 minutes
→ Check eduke-database service status

❌ Variables changed but not applied
→ Service needs restart
→ Dashboard → Redeploy
```

**Fix**:

```
1. Go to Service → Environment
2. Verify each variable
3. Click "Save"
4. Service auto-restarts (or click Redeploy)
5. Check logs for confirmation
```

---

## Database Issues

### Database Connection Error - "ECONNREFUSED"

**Problem**: Cannot connect to PostgreSQL

**Check**:
1. PostgreSQL service is running (check Dashboard)
2. DATABASE_URL format is correct
3. Credentials are right
4. SSL mode is required

**Solution**:

```bash
# 1. Verify DATABASE_URL
# Should look like:
# postgresql://user:pass@host:5432/db?sslmode=require

# 2. Check it's in environment
# Dashboard → Service → Environment → DATABASE_URL

# 3. Test connection
curl https://eduke-server.onrender.com/health
# Look for database info

# 4. If still failing:
# - Wait 5 minutes (Postgres initializing)
# - Redeploy service
# - Reinitialize database
```

### Database Schema Missing - "Relation does not exist"

**Problem**: Tables missing from database

**Check**: 
1. Logs show "Database schema ensured" or "Schema created"
2. Database is actually PostgreSQL (not SQLite)
3. Database exists and is accessible

**Fix**:

```bash
# Method 1: In Render Shell
NODE_ENV=production node scripts/init-db.js --production

# Method 2: Through SSH
# Dashboard → Service → Shell
# Run: npm run db:init:prod

# Method 3: Redeploy after fixing
# If script has errors, fix locally first
```

### Database Schema Upgrades Failed

**Problem**: New columns not created, "ALTER TABLE failed"

**Check logs** for:
```
"Failed to ensure schema upgrades"
"Column already exists"
"Syntax error in ALTER TABLE"
```

**Fix**:

```bash
# 1. Check what columns exist
# View database schema in Render Postgres

# 2. Try reinitializing
NODE_ENV=production node scripts/init-db.js --production

# 3. If specific column is missing, manually create it
# Through Postgres management tool or Render shell
```

---

## Backend Issues

### Backend Responds with 503 - "Service Unavailable"

**Problem**: Backend starts but health check fails

**Check**:
1. Logs for errors on startup
2. Database connection
3. Environment variables set

**Logs might show**:
```
❌ "Cannot find module"
→ Missing dependency
→ Add to package.json

❌ "JWT_SECRET not set"
→ Add to Environment variables

❌ "Database connection timeout"
→ PostgreSQL not ready
→ Wait 3 minutes and retry
```

**Fix**:

1. Check logs: Dashboard → Logs
2. Fix errors locally
3. Test locally: `npm run dev`
4. Commit and push
5. Render auto-deploys

### Authentication Fails - "Invalid Token"

**Problem**: Login fails, JWT error

**Causes**:

```
❌ JWT_SECRET changed
→ Old tokens invalid
→ Users need to login again

❌ JWT_SECRET not set in production
→ Falls back to "change-me-in-production"
→ Set real secret in Environment

❌ Token expired
→ Normal behavior
→ Use refresh token

❌ Clock skew (time difference)
→ Check server time is correct
→ Usually Render handles this
```

**Fix**:

```bash
# 1. Regenerate JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Update in Render Dashboard
# Service → Environment → JWT_SECRET, JWT_REFRESH_SECRET

# 3. Restart service (auto on env change)

# 4. Clear auth cookies in browser
# Browser DevTools → Application → Cookies → Delete

# 5. Try login again
```

### Routes Return 404 - "Not found"

**Problem**: API endpoints return 404

**Check**:
1. API URL is correct: `https://eduke-server.onrender.com/api/...`
2. Route exists in code
3. Middleware isn't blocking

**Test**:

```bash
# Test basic health
curl https://eduke-server.onrender.com/health
# Should return JSON

# Test API route
curl https://eduke-server.onrender.com/api/something
# Should return data or 401 if auth required
```

---

## Frontend Issues

### Blank White Screen - "App not loading"

**Problem**: Frontend loads but shows blank page

**Check**:
1. Browser console for errors (DevTools → Console)
2. Network tab (DevTools → Network)
3. VITE_API_URL is correct

**Common errors**:

```
❌ "Cannot fetch /api"
→ CORS error
→ Fix CORS_ORIGIN in backend

❌ "404 static/js/..."
→ Build didn't work
→ Check eduke-client logs

❌ "Uncaught TypeError"
→ JavaScript error
→ Check browser console
→ Fix locally and redeploy

❌ "Module not found"
→ Missing import
→ Check import paths
```

**Fix**:

```bash
# 1. Check browser console for exact error
# Right-click → Inspect → Console tab

# 2. Check VITE_API_URL
# Is backend URL correct?

# 3. Check CORS
# Backend should allow frontend URL

# 4. Hard refresh browser
# Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

# 5. Clear service worker cache
# DevTools → Application → Service Workers → Unregister
```

### CORS Error - "Access to XMLHttpRequest blocked"

**Problem**: Frontend cannot call API

**Error in console**:
```
Access to XMLHttpRequest at 'https://...' from origin 'https://...'
has been blocked by CORS policy
```

**Fix**:

1. **Check CORS_ORIGIN in backend**:
   - Dashboard → eduke-server → Environment
   - Find `CORS_ORIGIN`
   - Should be: `https://eduke-client.onrender.com`

2. **Restart backend**:
   - Dashboard → Redeploy
   - Wait for restart

3. **Refresh frontend**:
   - Hard refresh: Ctrl+Shift+R
   - Clear cookies: DevTools → Application → Clear

4. **Check API URL in frontend**:
   - Should match backend URL
   - `VITE_API_URL=https://eduke-server.onrender.com/api`

### Uploads Not Working - "Upload failed"

**Problem**: File upload fails

**Check**:
1. `MAX_FILE_SIZE` setting
2. Disk space on server
3. Upload directory exists

**Fix**:

```bash
# 1. Check upload folder exists
# In Render Shell:
ls -la /opt/render/project/server/uploads

# 2. Create if missing
mkdir -p /opt/render/project/server/uploads

# 3. Check permissions
chmod 755 /opt/render/project/server/uploads

# 4. Check file size isn't too large
# Default: 5MB (5242880 bytes)
# Increase in Environment: MAX_FILE_SIZE

# 5. Test upload again
```

---

## Monitoring & Performance

### Service Running Out of Memory - "OOM Killer"

**Problem**: Logs show memory errors, service restarts

**Fix**:

1. **Upgrade plan**:
   - Dashboard → Settings → Plan
   - Higher tier = more memory

2. **Optimize code**:
   - Check for memory leaks
   - Look for infinite loops
   - Profile locally first

3. **Monitor usage**:
   - Dashboard → Metrics
   - Check memory trends

### Service Too Slow - High Response Times

**Problem**: API responses slow

**Check**:
1. Database query performance
2. No infinite loops
3. CPU usage in Metrics tab

**Fix**:

1. **Add caching**:
   - Reduce database queries
   - Cache frequently accessed data

2. **Optimize queries**:
   - Add database indexes
   - Use pagination

3. **Scale up**:
   - Dashboard → Settings → Plan
   - Or add more instances

### Cold Starts - First Request Slow

**Problem**: First request after idle takes 5-10 seconds

**Normal for free tier** - Render puts idle services to sleep

**Fix** - No fix needed, expected behavior

---

## Rollback Issues

### Need to Go Back to Previous Version

**Steps**:

1. Dashboard → Service → Deployments
2. Find previous deployment
3. Click the deployment date
4. Click "Redeploy"
5. Confirm

**Before rollback**, check:
- What changed between versions
- If database schema changed (may need migration)
- If environment variables changed

---

## Emergency Troubleshooting

### Service Won't Start - Constant Restarts

**Check in order**:

1. **View logs** → Most recent error
2. **Check environment variables** → All set?
3. **Check secrets** → JWT_SECRET, DATABASE_URL set?
4. **Check database** → Connection working?
5. **Redeploy with current code** → Fresh start
6. **Check for syntax errors** → Review latest changes

### Complete Service Recovery

**Nuclear option** - Redeploy everything:

1. **Backend**:
   - Dashboard → eduke-server → Redeploy

2. **Database**:
   - Dashboard → eduke-database → Redeploy
   - Wait 2 minutes

3. **Frontend**:
   - Dashboard → eduke-client → Redeploy

4. **Reinitialize**:
   - Shell → `NODE_ENV=production node scripts/init-db.js --production`

---

## Getting Help

### Where to Check First

1. **Render Dashboard Logs**:
   - Service → Logs tab
   - Shows real-time errors
   - Search for "error" or "ERROR"

2. **Health Endpoint**:
   ```bash
   curl https://eduke-server.onrender.com/health
   ```

3. **Browser DevTools**:
   - Console tab for errors
   - Network tab to see requests
   - Application tab for storage

### Debug Commands

```bash
# Check environment
echo $NODE_ENV
echo $APP_ENV
echo $DATABASE_URL

# Check processes
ps aux | grep node

# Check disk
df -h

# Check memory
free -h

# Test database
psql $DATABASE_URL -c "SELECT version();"
```

### Contacting Support

**Render Support**: https://render.com/support  
**Response time**: Usually within 2 hours

**Provide**:
- Error message (exact text)
- Service name and URL
- What you were trying to do
- Steps to reproduce

---

## Prevention

### Avoid Common Issues

✅ **Regularly test locally**:
```bash
npm run dev
```

✅ **Keep dependencies updated**:
```bash
npm outdated
npm update
```

✅ **Monitor in production**:
- Check Dashboard metrics weekly
- Review logs for errors
- Test API endpoints regularly

✅ **Use version control**:
- Always commit working code
- Can rollback if needed

✅ **Document your setup**:
- Keep track of environment variables
- Document custom configurations
- Note any special setup steps

---

**Last Updated**: November 2024  
**Version**: 1.0
