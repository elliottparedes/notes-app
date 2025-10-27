# 🚨 URGENT: Security Issue & Resolution

## Critical Issue Detected

Netlify's secrets scanner detected your actual production credentials in the build output. **These credentials are now considered compromised** and must be rotated immediately.

### Exposed Credentials Found:
- ❌ MySQL database credentials (158.101.16.104)
- ❌ OpenRouter API key
- ❌ MongoDB credentials
- ❌ MinIO access keys

## Immediate Actions Required

### ✅ Step 1: Rotate ALL Compromised Credentials (DO THIS FIRST!)

**Critical:** Assume these credentials are compromised. Change them NOW:

1. **MySQL Database:**
   - Log into your MySQL server at `158.101.16.104`
   - Create a new user with a new password OR change existing password:
   ```sql
   ALTER USER 'mysql'@'%' IDENTIFIED BY 'NEW_SECURE_PASSWORD_HERE';
   FLUSH PRIVILEGES;
   ```

2. **OpenRouter API Key:**
   - Go to OpenRouter dashboard
   - Revoke the old key: `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`
   - Generate a new API key

3. **MongoDB:**
   - Log into MongoDB at `158.101.16.104:27017`
   - Change the root password:
   ```javascript
   db.changeUserPassword("root", "NEW_SECURE_PASSWORD_HERE")
   ```

4. **MinIO:**
   - Log into MinIO dashboard at `minio-api.paredes.cloud`
   - Revoke old access key: `N49lo4ioMqvfSOcK`
   - Create new access key and secret

### ✅ Step 2: Verify .env is NOT in Git (Already Done)

Good news: Your `.env` file is properly ignored and was never committed to Git history.

### ✅ Step 3: Configure Netlify Properly

The issue is that environment variables set in Netlify's build environment get inlined into the server bundle during build, exposing them to the scanner.

**DO NOT set actual production secrets in Netlify's environment variables UI yet!**

Instead, configure Netlify to handle secrets at runtime:

1. In Netlify, go to: **Site configuration** → **Functions** → **Environment variables**

2. Create a `netlify.toml` that prevents secret inlining (already done, but verify):

The current configuration uses `runtimeConfig` properly in `nuxt.config.ts` ✅

### ✅ Step 4: Use Netlify Functions Environment Variables

After rotating credentials:

1. Go to Netlify site → **Site configuration** → **Environment variables**
2. Set these with your **NEW rotated credentials**:
   - `DB_HOST`
   - `DB_PORT`
   - `DB_USER`
   - `DB_PASSWORD`
   - `DB_NAME`
   - `JWT_SECRET` (generate new: `openssl rand -base64 32`)
   - `OPENROUTER_API_KEY` (your new key)

3. These will be available at runtime, not baked into build

### ✅ Step 5: Clean Your Local .env

Update your local `.env` file with the new rotated credentials:

```env
# Use your NEW credentials after rotation
DB_HOST=158.101.16.104
DB_PORT=3306
DB_USER=mysql
DB_PASSWORD=YOUR_NEW_MYSQL_PASSWORD
DB_NAME=default

JWT_SECRET=YOUR_NEW_JWT_SECRET_32_CHARS_MINIMUM
OPENROUTER_API_KEY=YOUR_NEW_OPENROUTER_KEY
```

### ✅ Step 6: Deploy with New Configuration

```bash
# Commit the configuration changes (NOT the .env file)
git add nuxt.config.ts netlify.toml .nvmrc package.json
git commit -m "Security: Configure proper runtime environment handling"
git push origin main
```

Then in Netlify:
1. Clear build cache: **Deploys** → **Trigger deploy** → **Clear cache and deploy site**
2. The build should now pass without exposing secrets

## Why This Happened

Nitro (Nuxt's server engine) can inline environment variables during the build process when they're available at build time. This means:

1. ✅ Your code (`server/utils/db.ts`) is correct - it uses `useRuntimeConfig()`
2. ✅ Your `.env` is properly in `.gitignore`
3. ❌ The issue: Setting env vars in Netlify's build environment caused them to be inlined into the build output

## Prevention Going Forward

1. **Never** commit `.env` to Git (already protected ✅)
2. **Never** put real credentials in documentation (fixed ✅)
3. **Always** use Netlify's environment variables feature for runtime secrets
4. **Verify** that secrets are not inlined by checking build logs
5. **Rotate** credentials if they ever appear in logs or build artifacts

## Verification Checklist

After following all steps:

- [ ] All credentials rotated (MySQL, OpenRouter, MongoDB, MinIO)
- [ ] New credentials set in Netlify environment variables
- [ ] Local `.env` updated with new credentials
- [ ] Changes committed and pushed
- [ ] Build cache cleared in Netlify
- [ ] New deployment successful without secret scanner errors
- [ ] Application tested with new credentials

## Additional Security Measures

1. **Enable IP whitelisting** on your MySQL/MongoDB servers if possible
2. **Use strong passwords** (minimum 32 random characters)
3. **Enable 2FA** on all service dashboards
4. **Monitor access logs** for any suspicious activity
5. **Consider using a secrets manager** like AWS Secrets Manager or HashiCorp Vault

## Questions?

If you have questions about this process:
1. Check Netlify's documentation: https://docs.netlify.com/environment-variables/overview/
2. Review Nuxt's runtime config: https://nuxt.com/docs/guide/going-further/runtime-config
3. Contact your database provider for credential rotation help

## Timeline

**Act immediately:** These credentials are now public in your Netlify build logs. Rotate them within the next hour.

