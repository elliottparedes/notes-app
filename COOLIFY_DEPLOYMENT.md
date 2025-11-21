# Coolify Deployment Guide - Unfold Notes

## ✅ Pre-Deployment Checklist

### 1. **Package.json Configuration** ✅ VERIFIED
- ✅ `start` script present: `node .output/server/index.mjs`
- ✅ `build` script present: `nuxt build`
- ✅ `dotenv` dependency added for migrations
- ✅ Cross-platform `rimraf` for clean script
- ✅ Node.js version specified: `>=20.0.0`

### 2. **Environment Variables** ⚠️ REQUIRED

All environment variables MUST be set in Coolify before deployment:

#### Database (Required)
```bash
DB_HOST=your-database-host.com
DB_PORT=3306
DB_USER=your-db-user
DB_PASSWORD=your-secure-database-password
DB_NAME=notes
```

#### Application (Required)
```bash
NODE_ENV=production
JWT_SECRET=your-secure-jwt-secret-min-32-chars
```

⚠️ **SECURITY WARNING**: Generate a new JWT_SECRET for production:
```bash
openssl rand -base64 32
```

#### Email Service (Required for password reset)
```bash
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER_EMAIL=no-reply@your-domain.com
```

#### AI Features (Optional)
```bash
OPENROUTER_API_KEY=your-openrouter-api-key
```

#### MinIO Storage (Optional)
```bash
MINIO_ENDPOINT=https://your-minio-endpoint.com
MINIO_ACCESS_KEY=your-minio-access-key
MINIO_SECRET_KEY=your-minio-secret-key
MINIO_BUCKET=notes
MINIO_USE_SSL=true
```

#### WebSocket (Optional - for real-time collaboration)
```bash
NUXT_PUBLIC_YJS_URL=wss://your-yjs-server.com
```

> **⚠️ IMPORTANT**: Replace all placeholder values above with your actual credentials from your `.env` file. 
> Never commit actual credentials to Git!

#### SEO/URLs (Optional)
```bash
NUXT_PUBLIC_BASE_URL=https://your-domain.com
APP_URL=https://your-domain.com
```

### 3. **Database Schema** ✅ VERIFIED
- ✅ Connection uses environment variables
- ✅ Connection pooling configured (10 connections)
- ✅ Parameterized queries prevent SQL injection
- ✅ Health check endpoint available at `/api/health`

### 4. **Security** ✅ VERIFIED
- ✅ No hardcoded credentials in codebase
- ✅ `.env` file in `.gitignore`
- ✅ Password hashing with bcrypt (10 rounds)
- ✅ JWT token authentication
- ✅ Protected API routes with auth middleware

## 🚀 Coolify Configuration

### Build Settings

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm start
```

**Port:** `3000` (Nuxt's default port)

**Node Version:** `20` (specified in `.nvmrc`)

### Health Check (Optional but Recommended)

**Health Check Path:** `/api/health`

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-21T04:14:15.000Z",
  "service": "markdown-notes-app",
  "database": "connected"
}
```

## 📋 Deployment Steps

1. **Push Changes to Repository**
   ```bash
   git add .
   git commit -m "Add deployment fixes for Coolify"
   git push origin main
   ```

2. **Configure Coolify Project**
   - Create new project in Coolify
   - Connect to your Git repository
   - Set branch to `main`

3. **Set Environment Variables**
   - Go to Environment tab in Coolify
   - Add all required variables from section 2 above
   - ⚠️ Make sure to click "Save" after adding each variable

4. **Configure Build Settings**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Port: `3000`

5. **Deploy**
   - Click "Deploy" button
   - Monitor build logs for errors
   - Check application logs after deployment

## 🔍 Troubleshooting

### Issue: `/bin/bash: -c: option requires an argument`
**Solution:** ✅ FIXED - Added `start` script to `package.json`

### Issue: `Cannot find module 'dotenv'`
**Solution:** ✅ FIXED - Added `dotenv` to dependencies

### Issue: Database connection fails
**Verify:**
- Database is accessible from Coolify server
- Credentials are correct
- Port 33066 is open
- Database `notes` exists

**Test connection:**
```bash
mysql -h 155.117.44.112 -P 33066 -u root -p
```

### Issue: Application crashes on startup
**Check logs for:**
- Missing environment variables
- Database schema issues
- Port conflicts
- Memory limits

### Issue: 502 Bad Gateway
**Possible causes:**
- Application not listening on port 3000
- Start command incorrect
- Application crashed during startup

**Check:**
```bash
# In Coolify logs, look for:
# "Nuxt is listening on http://localhost:3000"
```

## 📊 Post-Deployment Verification

### 1. Test Health Endpoint
```bash
curl https://your-domain.com/api/health
```

Expected: `{"status":"healthy","database":"connected"}`

### 2. Test Authentication
- Try signing up at `/signup`
- Try logging in at `/login`
- Verify dashboard loads at `/dashboard`

### 3. Test Database
- Create a new note
- Refresh page - note should persist
- Create a folder
- Add tags to a note

### 4. Test AI Features (if enabled)
- Try "Generate Note" feature
- Try "Polish Text" feature

### 5. Test PWA
- Install app (should show install prompt)
- Go offline
- Create a note offline
- Go back online - note should sync

## 🔒 Security Best Practices

### Production Checklist
- [ ] Generate new `JWT_SECRET` for production
- [ ] Use strong database password
- [ ] Enable HTTPS/SSL in Coolify
- [ ] Set `NODE_ENV=production`
- [ ] Configure CORS if needed
- [ ] Set up database backups
- [ ] Monitor application logs
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Configure rate limiting
- [ ] Enable database SSL connection (if available)

### Environment Variable Security
- Never commit `.env` file
- Never expose API keys in client code
- Rotate secrets regularly
- Use different credentials for dev/staging/prod
- Limit database user permissions

## 📈 Performance Optimization

### Recommended Coolify Settings
- **Memory:** Minimum 512MB, Recommended 1GB
- **CPU:** Minimum 0.5 cores, Recommended 1 core
- **Storage:** Minimum 1GB for app + node_modules

### Database Optimization
- Connection pooling already configured (10 connections)
- Full-text search indexes on notes table
- JSON fields for tags and folder_order

### Caching
- Static assets cached via Nuxt
- Service worker caches app shell
- IndexedDB for offline data

## 🆘 Support

If deployment fails:

1. **Check Coolify Logs**
   - Build logs for compilation errors
   - Application logs for runtime errors

2. **Common Log Patterns**
   - `ECONNREFUSED`: Database connection issue
   - `MODULE_NOT_FOUND`: Missing dependency
   - `EADDRINUSE`: Port conflict
   - `JWT_SECRET is required`: Missing env var

3. **Test Locally First**
   ```bash
   npm run build
   npm start
   ```

4. **Database Migration**
   If you need to run migrations:
   ```bash
   npm run migrate
   ```

## ✅ Deployment Status

- [x] Package.json configured
- [x] Start script added
- [x] Dependencies complete
- [x] Environment variables documented
- [x] Security verified
- [x] Database connection tested
- [x] Health check endpoint ready
- [ ] Deployed to Coolify
- [ ] DNS configured
- [ ] SSL enabled
- [ ] Monitoring set up

---

**Last Updated:** November 21, 2025  
**Application:** Unfold Notes - Markdown Notes App  
**Version:** 1.0.0

