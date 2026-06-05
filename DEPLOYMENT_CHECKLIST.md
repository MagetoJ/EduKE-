# EduKE Render Deployment Checklist

## Pre-Deployment Verification ✓

### Code Quality
- [x] **TypeScript Errors**: No build errors (verified with `npm run build`)
  ```
  ✓ 2564 modules transformed
  ✓ built in 1m 1s
  ```
- [x] **Linting**: Project follows ESLint standards (`npm run lint`)
- [x] **Build Artifacts**: Frontend builds to `dist/` directory
- [x] **Monorepo Structure**: Proper project references in `tsconfig.json`

### Configuration Files
- [x] **render.yaml**: Configured for monorepo deployment
  - Web service: `eduke` (Frontend + Backend)
  - Database service: `eduke-database` (PostgreSQL 15)
  - Build command: `npm install --include=dev && npm run build && cd server && npm install`
  - Start command: `cd server && npm start`
  - Health check: `/health` endpoint

- [x] **.gitignore**: Properly configured
  - Excludes `node_modules/`, `dist/`, `.env` files
  - Excludes uploads and database files
  - Prevents secrets from being committed

- [x] **package.json** (Root):
  - Build script: `tsc -b && vite build` (monorepo-aware)
  - TypeScript project references enabled

- [x] **server/package.json**:
  - Start script: `cross-env NODE_ENV=production node index.js`
  - All required dependencies present
  - Node 18+ compatible

### Environment Setup
- [ ] **JWT Secrets**: Generate two unique secrets (done on Render)
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- [ ] **Environment Variables**: To be set in Render Dashboard
  - `NODE_ENV`: `production`
  - `APP_ENV`: `production`
  - `JWT_SECRET`: [generated]
  - `JWT_REFRESH_SECRET`: [generated]
  - `DATABASE_URL`: [auto-populated by Render]
  - `CORS_ORIGIN`: `https://eduke.onrender.com`
  - `FRONTEND_URL`: `https://eduke.onrender.com`
  - `VITE_API_URL`: `https://eduke.onrender.com/api`

### Database & Files
- [x] **Database Schema**: Defined in `database/schema.sql`
  - 15+ core tables
  - Indexes and constraints defined
  - Ready for PostgreSQL 15

- [x] **Uploads Directory**: Configured
  - Mounted as Render disk: `eduke-uploads` (10GB)
  - Path: `/opt/render/project/server/uploads`

- [x] **Database Disk**: Configured
  - Mounted as Render disk: `eduke-db-storage` (50GB)
  - Path: `/var/lib/postgresql/data`

## Deployment Steps

### Step 1: Prepare Repository
```bash
# Ensure all changes are committed
git status

# Push to GitHub (main branch preferred)
git push origin main
```

### Step 2: Deploy on Render

1. Go to https://dashboard.render.com
2. Click **New +** → **Blueprint**
3. Paste GitHub repository URL
4. Click **Connect**
5. Click **Create New Services**
6. Wait 5-10 minutes for build to complete

### Step 3: Configure Secrets (On Render Dashboard)

1. Generate JWT secrets:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Go to `eduke` service → **Environment**
3. Add:
   - `JWT_SECRET`: [paste generated secret 1]
   - `JWT_REFRESH_SECRET`: [paste generated secret 2]
4. Click **Save** (service auto-restarts)

### Step 4: Initialize Database

1. Go to `eduke` service → **Shell**
2. Run database initialization:
   ```bash
   NODE_ENV=production node scripts/init-db.js --production
   ```
3. Wait for completion

### Step 5: Verify Deployment

Test the health endpoint:
```bash
curl https://eduke.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": {
    "config": "PostgreSQL (production)",
    "tableCount": 15
  },
  "timestamp": "2025-11-21T..."
}
```

### Step 6: Test Application

1. Open https://eduke.onrender.com
2. Verify frontend loads
3. Test login functionality
4. Check API responses

## Post-Deployment Configuration

### Essential
- [ ] Add custom domain (optional)
- [ ] Enable database backups
- [ ] Set up monitoring alerts
- [ ] Configure auto-deploy from GitHub (Settings → Deploy)

### Recommended
- [ ] Review logs for errors: Dashboard → Logs
- [ ] Check metrics: Dashboard → Metrics
- [ ] Set up email notifications for failures
- [ ] Document admin user credentials securely

## Troubleshooting Guide

### Build Failures
**Error**: `npm install --include=dev` fails
- Check Node version (requires 18+)
- Verify package.json has correct dependencies
- Clear npm cache: `npm cache clean --force`

**Error**: TypeScript compilation errors
- Check build output: `npm run build` locally
- Verify no unused imports/variables
- Ensure tsconfig.json is valid

### Runtime Issues
**Error**: `Cannot find module` in production
- Verify build command runs in correct directory
- Check server/package.json dependencies
- Ensure NODE_ENV=production is set

**Error**: Frontend shows blank page
- Check VITE_API_URL environment variable
- Verify frontend built to `dist/` directory
- Check browser console for errors

**Error**: Database connection fails
- Wait 3+ minutes for PostgreSQL to initialize
- Verify DATABASE_URL is auto-populated
- Check security group allows connections
- Run health check to verify

### Authentication Issues
**Error**: JWT token invalid
- Regenerate JWT_SECRET and JWT_REFRESH_SECRET
- Update in Render environment
- Clear browser cookies/localStorage
- Restart service

## Performance Optimization

### Current Configuration
- **Build Time**: ~1 minute
- **Frontend Bundle**: ~1MB (gzipped)
- **Startup Time**: <30 seconds
- **Chunk Size Warning**: 5000KB limit

### Recommendations
- Enable Render's auto-scaling (Settings)
- Set up CDN for static assets
- Monitor database query performance
- Use Render's metrics dashboard

## Maintenance

### Regular Tasks
- [ ] Monitor disk usage (uploads, database)
- [ ] Review error logs weekly
- [ ] Update dependencies monthly
- [ ] Test backup restoration quarterly

### Secrets Management
- [ ] Rotate JWT secrets every 90 days
- [ ] Use Render's environment variable sync
- [ ] Never commit `.env` files
- [ ] Document secret rotation process

## Support & References

- **Render Docs**: https://render.com/docs
- **Express.js Guide**: https://expressjs.com/
- **React Documentation**: https://react.dev/
- **PostgreSQL Docs**: https://www.postgresql.org/docs/15/

---

**Last Updated**: 2025-11-21  
**Status**: ✅ Ready for Deployment  
**Next Step**: Push code to GitHub and deploy
