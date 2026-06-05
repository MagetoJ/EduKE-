# Render Deployment - Quick Start (5-10 minutes)

## Monorepo Deployment

This is a **monorepo** deployment - both frontend and backend run from one service!

## Prerequisites

✓ Render account at https://render.com  
✓ Code pushed to GitHub  
✓ This repository has `render.yaml`  

---

## Step 1: Start Deployment (1 min)

1. Go to https://dashboard.render.com
2. Click **New +** → **Blueprint**
3. Paste your GitHub repo URL
4. Click **Connect**
5. Click **Create New Services**

→ *Wait 3-5 minutes while service builds and deploys*

**Services created**:
- `eduke` (Backend + Frontend in one service)
- `eduke-database` (PostgreSQL)

---

## Step 2: Set Secrets (2 mins)

**Generate JWT secrets** (run once in terminal):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

In Render Dashboard:

1. Go to `eduke` service
2. Click **Environment**
3. Add these environment variables:

| Key | Value |
|-----|-------|
| `JWT_SECRET` | [Paste generated secret 1] |
| `JWT_REFRESH_SECRET` | [Paste generated secret 2] |

4. Click **Save**
5. Service auto-restarts

---

## Step 3: Initialize Database (2 mins)

1. Go to `eduke` service in dashboard
2. Click **Shell**
3. Run:
```bash
NODE_ENV=production node scripts/init-db.js --production
```

✓ Database initialized!

---

## Step 4: Verify Deployment (1 min)

Test health endpoint:
```bash
curl https://eduke.onrender.com/health
```

Should return:
```json
{
  "status": "healthy",
  "database": {
    "config": "PostgreSQL (production)",
    "tableCount": 15
  },
  "timestamp": "..."
}
```

✓ API working!

---

## Step 5: Test Application (1 min)

1. Open https://eduke.onrender.com
2. App should load (frontend served from same service)
3. Try login

✓ Complete!

---

## Environment Auto-Detection

Your app automatically knows it's in **production**:

```
🌍 NODE_ENV: production
🌍 APP_ENV: production
⚙️  Environment Mode: PRODUCTION 🔒
💾 Database: PostgreSQL (production)
```

---

## Troubleshooting

### Blank page on frontend?

- Wait 5 mins (static builds take time)
- Check VITE_API_URL points to backend

### API 500 error?

- Check environment variables set
- Check database initialized
- View logs: Dashboard → Service → Logs

### Secrets not working?

- Regenerate JWT secrets
- Update in Environment tab
- Restart service

### Database won't connect?

- Verify DATABASE_URL is auto-set
- Wait 3 mins for Postgres to initialize
- Reinitialize database schema

---

## Next Steps

1. **Custom Domain**: Settings → Custom Domains
2. **Enable Backups**: Database → Settings
3. **Monitor Performance**: Metrics tab
4. **Read Full Guide**: See `RENDER_DEPLOYMENT_GUIDE.md`

---

**Total Time**: ~10 minutes  
**Cost**: Free tier available  
**Status**: 🟢 Production Ready
