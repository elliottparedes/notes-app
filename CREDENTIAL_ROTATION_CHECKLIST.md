# 🔐 Credential Rotation Checklist

**Status:** ⚠️ URGENT - Complete within 1 hour

## Why Rotate?
Your credentials were exposed in Netlify build logs when they were inlined into the server bundle during the build process. Consider all these credentials compromised.

## Rotation Steps

### 1. MySQL Database (158.101.16.104)
- [ ] Log in to MySQL server
- [ ] Create new password (32+ random characters)
- [ ] Run: `ALTER USER 'mysql'@'%' IDENTIFIED BY 'NEW_PASSWORD';`
- [ ] Run: `FLUSH PRIVILEGES;`
- [ ] Test new credentials locally
- [ ] Update in Netlify environment variables
- [ ] Update local `.env` file

**Generate secure password:**
```bash
openssl rand -base64 32
```

### 2. OpenRouter API Key
- [ ] Log into OpenRouter dashboard: https://openrouter.ai/
- [ ] Navigate to API Keys section
- [ ] Revoke old key: `sk-or-v1-eb4f656dc98078e31943073097a32ccb...`
- [ ] Generate new API key
- [ ] Update in Netlify environment variables
- [ ] Update local `.env` file
- [ ] Test AI features still work

### 3. MongoDB (158.101.16.104:27017)
- [ ] Log into MongoDB
- [ ] Connect: `mongo mongodb://158.101.16.104:27017`
- [ ] Switch to admin: `use admin`
- [ ] Authenticate with old credentials
- [ ] Change password: `db.changeUserPassword("root", "NEW_PASSWORD_HERE")`
- [ ] Test new credentials
- [ ] Update in Netlify environment variables
- [ ] Update local `.env` file

**Generate secure password:**
```bash
openssl rand -base64 32
```

### 4. MinIO (minio-api.paredes.cloud)
- [ ] Log into MinIO console: https://minio-api.paredes.cloud
- [ ] Navigate to Access Keys
- [ ] Delete old key: `N49lo4ioMqvfSOcK`
- [ ] Create new access key
- [ ] Update in Netlify environment variables
- [ ] Update local `.env` file
- [ ] Test file operations

### 5. JWT Secret
- [ ] Generate new secret (32+ characters)
- [ ] Update in Netlify environment variables
- [ ] Update local `.env` file
- [ ] Note: This will invalidate all existing user sessions

**Generate new JWT secret:**
```bash
openssl rand -base64 32
```

### 6. Session Password (if used)
- [ ] Generate new session password
- [ ] Update in Netlify environment variables
- [ ] Update local `.env` file

```bash
openssl rand -hex 16
```

## After Rotation

### Update Netlify Environment Variables
1. Go to: https://app.netlify.com → Your site → Site configuration → Environment variables
2. Update these with NEW credentials:
   - `DB_HOST` = 158.101.16.104
   - `DB_PORT` = 3306
   - `DB_USER` = mysql
   - `DB_PASSWORD` = [NEW MySQL password]
   - `DB_NAME` = default
   - `JWT_SECRET` = [NEW JWT secret]
   - `OPENROUTER_API_KEY` = [NEW OpenRouter key]
   - `MONGODB_URI` = [NEW MongoDB connection string]
   - `MINIO_ENDPOINT` = minio-api.paredes.cloud
   - `MINIO_ACCESS_KEY` = [NEW MinIO access key]
   - `MINIO_SECRET_KEY` = [NEW MinIO secret]
   - `MINIO_BUCKET` = notes

### Update Local .env
Create a new `.env` file with your NEW credentials:

```env
# NEW ROTATED CREDENTIALS - DO NOT COMMIT
OPENROUTER_API_KEY=[your_new_openrouter_key]
MONGODB_URI=mongodb://root:[new_password]@158.101.16.104:27017/?directConnection=true
NUXT_SESSION_PASSWORD=[new_session_password]
MINIO_ENDPOINT=minio-api.paredes.cloud
MINIO_ACCESS_KEY=[new_minio_access_key]
MINIO_SECRET_KEY=[new_minio_secret]
MINIO_BUCKET=notes
MYSQL_USERNAME=mysql
MYSQL_PASSWORD=[new_mysql_password]
MYSQL_CONNECTION_STRING=mysql://mysql:[new_mysql_password]@158.101.16.104:3306/default

# Markdown Notes App Configuration
DB_HOST=158.101.16.104
DB_PORT=3306
DB_USER=mysql
DB_PASSWORD=[new_mysql_password]
DB_NAME=default

# JWT Configuration
JWT_SECRET=[new_jwt_secret]

# Application Configuration
NODE_ENV=development
```

### Deploy with New Configuration
```bash
# Commit configuration changes (NOT .env)
git add nuxt.config.ts .gitignore
git commit -m "Security: Prevent environment variable inlining"
git push origin main

# In Netlify Dashboard:
# 1. Verify all new environment variables are set
# 2. Clear cache and deploy: Deploys → Trigger deploy → Clear cache and deploy site
```

### Verify Deployment
- [ ] Build completes without secret scanner errors
- [ ] Application loads without errors
- [ ] Login/signup works
- [ ] Database operations work
- [ ] AI features work (if using OpenRouter)
- [ ] File uploads work (if using MinIO)

## Additional Security Measures

### Network Security
- [ ] Enable IP whitelisting on MySQL (allow only Netlify IPs + your IP)
- [ ] Enable IP whitelisting on MongoDB
- [ ] Use VPC/private network if available

### Access Control
- [ ] Create separate database users for dev/prod
- [ ] Use principle of least privilege (minimal permissions)
- [ ] Enable 2FA on all service dashboards

### Monitoring
- [ ] Check MySQL access logs for suspicious activity
- [ ] Review OpenRouter API usage for unusual patterns
- [ ] Monitor Netlify deploy logs for future secret exposures

### Future Prevention
- [ ] Never set production secrets as build-time environment variables
- [ ] Use Netlify's context-specific environment variables
- [ ] Consider using a secrets manager (AWS Secrets Manager, etc.)
- [ ] Regularly rotate credentials (every 90 days)

## Timeline

- **0-1 hour:** Rotate all credentials (steps 1-6)
- **1-2 hours:** Update Netlify and redeploy
- **2-3 hours:** Verify and test
- **3-24 hours:** Monitor for suspicious activity

## Need Help?

**MySQL:** 
- Docs: https://dev.mysql.com/doc/refman/8.0/en/alter-user.html
- Password reset: https://dev.mysql.com/doc/refman/8.0/en/resetting-permissions.html

**MongoDB:**
- Change password: https://www.mongodb.com/docs/manual/tutorial/change-own-password-and-custom-data/

**MinIO:**
- Access keys: https://min.io/docs/minio/linux/administration/identity-access-management.html

**Netlify:**
- Environment variables: https://docs.netlify.com/environment-variables/overview/

---

**✅ Mark each checkbox as you complete the steps above.**

