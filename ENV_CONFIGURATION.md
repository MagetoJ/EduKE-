# Environment Configuration Reference

## Overview

EduKE uses environment variables to automatically detect and configure for **production** and **development** environments. This document explains all available environment variables and how they're used.

---

## Environment Detection

The application detects its environment using:

```javascript
const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_ENV = process.env.APP_ENV || NODE_ENV;
const isProduction = NODE_ENV === 'production' || APP_ENV === 'production';
```

### Production Environment

When either `NODE_ENV=production` or `APP_ENV=production`:

✅ Uses **PostgreSQL** database  
✅ Enables **production CORS** restrictions  
✅ Uses **PostgreSQL connection strings**  
✅ Applies **security headers**  
✅ Logs "PRODUCTION 🔒" mode  

### Development Environment

When `NODE_ENV` is not set or not `production`:

✅ Uses **SQLite** database  
✅ Uses **localhost CORS** settings  
✅ Reads `.env` file for local config  
✅ Enables **verbose logging**  
✅ Logs "DEVELOPMENT" mode  

---

## Backend Environment Variables

### Core Environment

| Variable | Value | Environment | Required | Description |
|----------|-------|-------------|----------|-------------|
| `NODE_ENV` | `production` / `development` | Both | Yes | Node.js environment mode |
| `APP_ENV` | `production` / `development` | Both | No | App-specific environment (overrides NODE_ENV) |
| `USE_PRODUCTION_DB` | `true` / `false` | Both | No | Force use of PostgreSQL (default: true in production) |
| `PORT` | `3001` (default) | Both | No | Server listening port |

### Database Configuration

#### Production (PostgreSQL)

```env
# Automatically set by Render from database service
DATABASE_URL=postgresql://user:pass@host:5432/eduke?sslmode=require
USE_PRODUCTION_DB=true
```

#### Development (SQLite)

```env
# Local PostgreSQL (optional)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=eduke
DB_USER=eduke_user
DB_PASSWORD=your-password

# Or uses SQLite automatically if not set
```

### Authentication

| Variable | Example | Environment | Required | Description |
|----------|---------|-------------|----------|-------------|
| `JWT_SECRET` | `abc123...` | Production | **Yes** | JWT signing secret (generate new) |
| `JWT_REFRESH_SECRET` | `def456...` | Production | **Yes** | JWT refresh token secret |
| `JWT_EXPIRES_IN` | `15m` | Both | No | Access token expiration |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Both | No | Refresh token expiration |
| `BCRYPT_SALT_ROUNDS` | `12` (default) | Both | No | Password hashing rounds |

### CORS & Frontend

| Variable | Value | Environment | Required | Description |
|----------|-------|-------------|----------|-------------|
| `CORS_ORIGIN` | `https://eduke-client.onrender.com` | Production | Yes | Allowed frontend URL |
| `CORS_ORIGIN` | `http://localhost:5173` | Development | Auto | Development frontend URL |
| `FRONTEND_URL` | `https://eduke-client.onrender.com` | Production | Yes | Frontend base URL |

### Email Configuration

| Variable | Example | Environment | Optional | Description |
|----------|---------|-------------|----------|-------------|
| `SMTP_HOST` | `smtp.gmail.com` | Both | Yes | Email server host |
| `SMTP_PORT` | `587` | Both | Yes | Email server port |
| `SMTP_USER` | `email@gmail.com` | Both | Yes | Email account username |
| `SMTP_PASSWORD` | `app-password` | Both | Yes | Email account password |
| `EMAIL_FROM` | `noreply@eduke.com` | Both | Yes | Sender email address |

### File Upload

| Variable | Value | Environment | Optional | Description |
|----------|-------|-------------|----------|-------------|
| `MAX_FILE_SIZE` | `5242880` (5MB) | Both | Yes | Maximum upload size in bytes |
| `UPLOAD_DIR` | `./uploads` | Both | Yes | Upload directory path |

### Rate Limiting

| Variable | Value | Environment | Optional | Description |
|----------|-------|-------------|----------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `900000` (15 min) | Both | Yes | Rate limit time window |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Both | Yes | Requests per window |

### Admin Defaults

| Variable | Example | Environment | Optional | Description |
|----------|---------|-------------|----------|-------------|
| `SUPER_ADMIN_USERNAME` | `admin@school.com` | Both | Yes | Initial admin username |
| `SUPER_ADMIN_PASSWORD` | `secure-password` | Both | Yes | Initial admin password |

---

## Frontend Environment Variables

### Build Configuration

| Variable | Value | Environment | Required | Description |
|----------|-------|-------------|----------|-------------|
| `NODE_ENV` | `production` | Production | Yes | Build mode |
| `APP_ENV` | `production` | Production | No | App environment indicator |
| `VITE_API_URL` | `https://eduke-server.onrender.com/api` | Production | Yes | Backend API endpoint |
| `VITE_API_URL` | `http://localhost:3001/api` | Development | Auto | Local API endpoint |

---

## Database Connection Strings

### Production (PostgreSQL on Render)

```
postgresql://eduke_user:password@host.postgres.render.com:5432/eduke?sslmode=require
```

**Connection Parameters**:
- **Host**: `host.postgres.render.com` (from Render)
- **Port**: `5432` (PostgreSQL default)
- **Database**: `eduke`
- **User**: `eduke_user`
- **Password**: (from Render environment)
- **SSL**: Required (`sslmode=require`)

### Development (SQLite)

```
server/eduke.db
```

Or PostgreSQL locally:

```
postgresql://eduke_user:password@localhost:5432/eduke
```

---

## Setting Environment Variables in Different Environments

### Local Development

Create `server/.env`:

```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=local-dev-secret
JWT_REFRESH_SECRET=local-dev-refresh-secret
```

### Render Production

In **Render Dashboard**:

1. Go to service settings
2. Click **Environment**
3. Add variables:

```
NODE_ENV = production
APP_ENV = production
USE_PRODUCTION_DB = true
DATABASE_URL = [auto-populated]
JWT_SECRET = [generated value]
JWT_REFRESH_SECRET = [generated value]
CORS_ORIGIN = https://eduke-client.onrender.com
```

### Docker (If Using)

In `Dockerfile` or `docker-compose.yml`:

```dockerfile
ENV NODE_ENV=production
ENV APP_ENV=production
ENV USE_PRODUCTION_DB=true
ENV PORT=3001
```

---

## Environment-Specific Behavior

### Production Mode (NODE_ENV=production)

```javascript
// Database
✓ Uses PostgreSQL
✓ SSL/TLS connections required
✓ Connection pooling enabled

// CORS
✓ Restricted to CORS_ORIGIN value
✓ No wildcard origins

// Logging
✓ Production-level logging
✓ No sensitive data in logs

// Security
✓ HTTPS required
✓ Security headers enabled
✓ Rate limiting active
```

### Development Mode

```javascript
// Database
✓ Uses SQLite (file-based)
✓ Automatic schema initialization
✓ Easy reset/cleanup

// CORS
✓ Allows http://localhost:5173
✓ Credentials allowed

// Logging
✓ Verbose logging
✓ Development helpers enabled
✓ Error stack traces shown

// Security
✓ HTTP allowed locally
✓ Relaxed validation
✓ Debug endpoints available
```

---

## Generating Secure Values

### Generate JWT Secrets

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# OpenSSL
openssl rand -hex 32

# Online tool (not recommended for production)
# https://generate-secret.vercel.app/32
```

### PostgreSQL Password

```bash
# Generate strong password
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

---

## Common Environment Configurations

### Configuration: Render Production

```env
NODE_ENV=production
APP_ENV=production
USE_PRODUCTION_DB=true
PORT=3001
DATABASE_URL=postgresql://...@host.postgres.render.com/eduke
JWT_SECRET=[32-char hex]
JWT_REFRESH_SECRET=[32-char hex]
CORS_ORIGIN=https://eduke-client.onrender.com
FRONTEND_URL=https://eduke-client.onrender.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Configuration: Local Development

```env
NODE_ENV=development
APP_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=local-secret
JWT_REFRESH_SECRET=local-refresh
DB_HOST=localhost
DB_PORT=5432
DB_NAME=eduke
DB_USER=postgres
DB_PASSWORD=postgres
```

### Configuration: Docker/Container

```env
NODE_ENV=production
APP_ENV=production
USE_PRODUCTION_DB=true
PORT=3001
DATABASE_URL=postgresql://db_user:db_pass@postgres:5432/eduke
JWT_SECRET=[secure]
JWT_REFRESH_SECRET=[secure]
CORS_ORIGIN=https://api.yourdomain.com
```

---

## Troubleshooting Environment Issues

### Issue: Wrong database being used

**Check**:
```bash
# In logs, look for:
# "💾 Database: PostgreSQL" (production) ✓
# "💾 Database: SQLite" (development) ✓
```

**Solution**:
- Verify `NODE_ENV=production` is set
- Ensure `USE_PRODUCTION_DB=true` for production
- Check DATABASE_URL is not empty in production

### Issue: CORS errors

**Check**:
- Frontend URL: `https://eduke-client.onrender.com`
- `CORS_ORIGIN` environment variable
- Request headers in browser DevTools

**Solution**:
- Update `CORS_ORIGIN` to match frontend URL
- Restart service after changing environment variables
- Clear browser cache

### Issue: JWT authentication fails

**Check**:
- `JWT_SECRET` is set in environment
- Token hasn't expired
- Secret changed between deploys

**Solution**:
- Generate new JWT secrets
- Update in Render dashboard
- Restart service
- Clear authentication tokens in client

### Issue: Database connection timeout

**Check**:
- `DATABASE_URL` contains correct host
- PostgreSQL service is running
- SSL mode is set (`:sslmode=require`)

**Solution**:
- Verify database service is deployed first
- Check DATABASE_URL format
- Ensure SSL is enabled
- Wait 2-3 minutes for database to fully initialize

---

## Best Practices

✅ **DO**:
- Generate new secrets for production
- Use environment variables for sensitive data
- Rotate secrets periodically
- Document environment requirements
- Use strong passwords (32+ characters)

❌ **DON'T**:
- Commit secrets to version control
- Use same secrets in dev and production
- Share sensitive values in messages
- Use placeholder values in production
- Log sensitive data

---

## Environment Variable Reference

### Quick Setup Checklist

```
Production (Render):
□ NODE_ENV=production
□ APP_ENV=production
□ USE_PRODUCTION_DB=true
□ DATABASE_URL=[from Render Postgres]
□ JWT_SECRET=[generated]
□ JWT_REFRESH_SECRET=[generated]
□ CORS_ORIGIN=https://eduke-client.onrender.com
□ FRONTEND_URL=https://eduke-client.onrender.com

Development (Local):
□ NODE_ENV=development
□ FRONTEND_URL=http://localhost:5173
□ CORS_ORIGIN=http://localhost:5173
□ JWT_SECRET=local-dev-secret
□ JWT_REFRESH_SECRET=local-dev-refresh-secret
```

---

**Last Updated**: November 2024  
**Version**: 1.0
