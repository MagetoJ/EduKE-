# Monorepo Deployment Architecture

## Overview

EduKE is deployed as a **monorepo** on Render, meaning both the backend API and frontend application run from a single Node.js service.

---

## Architecture

### Directory Structure

```
eduke/ (root)
├── src/                  # Frontend source (React)
│   ├── react-app/
│   └── shared/
├── dist/                 # Frontend build output
├── server/               # Backend server
│   ├── index.js         # Express server (serves both API & frontend)
│   ├── package.json
│   ├── config.js
│   ├── database.js
│   ├── routes/          # API routes
│   ├── middleware/
│   └── uploads/         # File uploads
├── render.yaml          # Render deployment config
└── package.json         # Root package (frontend)
```

### Deployment Flow

```
1. Render detects push to GitHub
2. Build Phase:
   ├─ npm install (root - installs frontend deps)
   ├─ npm run build (builds React frontend to dist/)
   └─ cd server && npm install (installs backend deps)
3. Start Phase:
   └─ cd server && npm start (starts Express server)
4. Express Server:
   ├─ Serves /api/* routes (backend API)
   ├─ Serves static files from ../dist/ (frontend)
   └─ Serves index.html for client-side routing
```

---

## How It Works

### Express Serves Both Frontend and Backend

**server/index.js**:

```javascript
// 1. Serve static frontend files
app.use(express.static(frontendPath));

// 2. Serve API routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
// ... more API routes

// 3. Catch-all for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});
```

### Request Flow

```
User Request to https://eduke.onrender.com
        |
        v
    Express Server
        |
    ┌───┴─────────┬────────────┬─────────────┐
    |             |            |             |
    v             v            v             v
/api/...      /uploads/**  /dist/*      /*
(Routes)      (Files)      (Static)     (SPA)
    |             |            |             |
    └───┬─────────┴────────────┴─────────────┘
        |
    ┌───┴────────────────┐
    |                    |
    v                    v
API Response      Frontend HTML
```

---

## File Serving Priority

Express serves files in this order:

1. **Uploads** - `/uploads/*` → `server/uploads/`
2. **API Routes** - `/api/*` → Express routes
3. **Static Files** - `/dist/*`, `/js/*`, `/css/*` → `dist/` folder
4. **Catch-All** - `/*` → `dist/index.html` (for React Router)

---

## Build Process

### Step 1: Install Frontend Dependencies

```bash
npm install
# Installs packages from root package.json
# Required: React, Vite, routing libraries
```

### Step 2: Build Frontend

```bash
npm run build
# Vite builds React app
# Output: dist/
#   ├── index.html
#   ├── js/
#   ├── css/
#   └── assets/
```

### Step 3: Install Backend Dependencies

```bash
cd server && npm install
# Installs packages from server/package.json
# Required: Express, database drivers, etc.
```

### Step 4: Start Server

```bash
npm start
# Runs Node.js server
# Environment: NODE_ENV=production
# Loads .env variables
```

---

## Environment Variables

### Frontend Build Time

Used during `npm run build`:

```
NODE_ENV=production
VITE_API_URL=https://eduke.onrender.com/api
```

**In frontend code**:
```javascript
const apiUrl = import.meta.env.VITE_API_URL;
// Uses: https://eduke.onrender.com/api
```

### Backend Runtime

Used when Express server starts:

```
NODE_ENV=production
APP_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
JWT_SECRET=[secure]
CORS_ORIGIN=https://eduke.onrender.com
```

---

## CORS Configuration

### How It Works

Frontend and backend are on **same domain** (`https://eduke.onrender.com`):

```javascript
// server/index.js
const corsOptions = {
  origin: isProduction ? process.env.CORS_ORIGIN : 'http://localhost:5173',
  credentials: true
};
```

**In production**:
- Request from: `https://eduke.onrender.com`
- API at: `https://eduke.onrender.com/api/*`
- **CORS not needed** (same origin)

**In development**:
- Frontend at: `http://localhost:5173`
- Backend at: `http://localhost:3001`
- **CORS needed** (different ports)

---

## Static File Serving

### Cache Strategy

**Production** (1 year cache):
```javascript
app.use(express.static(frontendPath, { 
  maxAge: '1y',
  etag: false 
}));
```

**Development** (no cache):
```javascript
app.use(express.static(frontendPath, { 
  maxAge: '0',
  etag: false 
}));
```

### File Types

```
/static/js/       → JavaScript bundles (cached)
/static/css/      → CSS bundles (cached)
/assets/          → Images, fonts (cached)
/index.html       → Not cached (fetched fresh each time)
```

---

## Client-Side Routing

### React Router SPA

The frontend is a **Single Page Application (SPA)**:

```
URL: https://eduke.onrender.com/dashboard
       ↓
Express serves: dist/index.html
       ↓
React Router intercepts and shows: Dashboard page
```

### Fallback Route

```javascript
// server/index.js - Catch-all route
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});
```

This ensures all routes serve `index.html`, allowing React Router to handle them.

---

## Advantages vs Separate Services

| Aspect | Monorepo | Separate |
|--------|----------|----------|
| **Cost** | 1 web service | 2 web services (2x cost) |
| **Latency** | None (same process) | Inter-service latency |
| **Deployment** | Single deploy | Multiple deploys |
| **Logs** | Single stream | Multiple log files |
| **Environment** | Shared vars | Separate configs |
| **Complexity** | Simpler | More complex |

---

## Development Workflow

### Local Development

**Terminal 1 - Frontend**:
```bash
npm run dev
# Runs Vite dev server at http://localhost:5173
# Hot module replacement enabled
```

**Terminal 2 - Backend**:
```bash
cd server
npm run dev
# Runs nodemon watching for changes
# Server at http://localhost:3001
```

**Frontend config** (`vite.config.ts`):
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true
  }
}
```

This proxies `/api/*` calls to the backend during development.

### Local Production Build

Test monorepo build locally:

```bash
# Build frontend
npm run build

# Install server dependencies
cd server && npm install

# Start server
NODE_ENV=production npm start
# Visits http://localhost:3000
```

---

## Troubleshooting

### Issue: Frontend doesn't load

**Check**:
1. `npm run build` created `dist/` folder
2. Static files are in `dist/`
3. Express is serving static files

**Debug**:
```bash
# Check dist folder exists
ls -la dist/

# Check file paths
find dist -type f | head -20
```

### Issue: Routes show 404

**Check**:
1. Non-API routes are not handled by Express
2. Catch-all route is after API routes

**Test**:
```bash
curl https://eduke.onrender.com/dashboard
# Should return HTML (index.html content)
# Not 404 error
```

### Issue: API calls return 404

**Check**:
1. API routes start with `/api/`
2. Routes are defined before catch-all
3. Backend is running

**Test**:
```bash
curl https://eduke.onrender.com/health
# Should return JSON

curl https://eduke.onrender.com/api/students
# Should return 401 (auth required) or data
```

### Issue: CORS errors

**Since same origin**, CORS shouldn't be an issue:

```bash
# Should NOT see CORS errors
# Both frontend and API at same https://eduke.onrender.com
```

If you see CORS errors:
1. Check `CORS_ORIGIN` is correct
2. Verify frontend URL matches
3. Check browser console for actual error

---

## Performance Considerations

### Bundle Size

Frontend bundle is cached and served once:
```
dist/
├── index.html        (not cached)
├── js/main.xxx.js   (cached 1 year)
└── css/style.xxx.css (cached 1 year)
```

### Database Connection

Shared connection pool:
```javascript
// One pool for entire application
const db = new Pool(config);
```

### Memory Usage

Both frontend (static) and backend (API) in one process:
```
Memory = Frontend static (small) + Backend runtime (most)
```

---

## Scaling Monorepo

### Vertical Scaling (More Powerful)

1. Go to Service Settings
2. Upgrade to Pro plan (more RAM/CPU)
3. Redeploy

### Horizontal Scaling (Multiple Instances)

1. Service Settings → Num Instances
2. Set to 2+ instances
3. Render auto load-balances

---

## Migration Guide

### From Separate Services to Monorepo

If migrating from separate frontend/backend:

1. **Remove** separate Render services
2. **Update** `render.yaml` to monorepo config
3. **Update** `server/index.js` to serve static files
4. **Update** frontend API URLs to relative paths
5. **Test** locally: `npm run build` then `npm start`
6. **Deploy** to Render

---

## Best Practices

✅ **DO**:
- Keep frontend build small (code-split large bundles)
- Cache-bust with content hashing (Vite does this)
- Use relative API paths (`/api/...`) instead of full URLs
- Monitor bundle size (`npm run build --analyze`)
- Separate concerns (frontend in src/, backend in server/)

❌ **DON'T**:
- Add large static files to dist/ (use CDN instead)
- Modify `dist/` files directly (rebuild instead)
- Put frontend routes in backend (use catch-all)
- Hardcode API URLs (use environment variables)

---

**Last Updated**: November 2024  
**Version**: 1.0
