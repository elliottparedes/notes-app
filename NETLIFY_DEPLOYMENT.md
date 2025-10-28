# Netlify Deployment Guide

This guide will help you deploy your Markdown Notes app to Netlify.

## What Was Fixed

The secret scanner issue has been resolved by:
1. ✅ Removed literal credential examples from documentation files
2. ✅ Created `.env.example` with safe placeholder values
3. ✅ Updated README.md, QUICKSTART.md, and SETUP.md to reference `.env.example`
4. ✅ Added `netlify.toml` configuration file

## Prerequisites

- A Netlify account (free tier is fine)
- Your app pushed to GitHub/GitLab/Bitbucket
- A MySQL database (can use PlanetScale, Railway, or any MySQL host)

## Step 1: Configure Environment Variables in Netlify

Before deploying, you MUST configure environment variables in Netlify's dashboard:

1. Go to your Netlify site dashboard
2. Navigate to **Site configuration** → **Environment variables**
3. Click **Add a variable** and add each of these:

### Required Variables

| Variable Name | Description | Example Value |
|--------------|-------------|---------------|
| `DB_HOST` | Your MySQL database host | `aws.connect.psdb.cloud` |
| `DB_PORT` | Your MySQL database port | `3306` |
| `DB_USER` | Your MySQL database username | (your username) |
| `DB_PASSWORD` | Your MySQL database password | (your password) |
| `DB_NAME` | Your database name | `markdown_notes` |
| `JWT_SECRET` | Random string (min 32 chars) | Generate with `openssl rand -base64 32` |
| `NODE_ENV` | Environment type | `production` |

### Optional Variables

| Variable Name | Description |
|--------------|-------------|
| `OPENROUTER_API_KEY` | For AI note generation features |

### Generate a Secure JWT Secret

On your local machine, run:
```bash
openssl rand -base64 32
```

Copy the output and use it as your `JWT_SECRET` in Netlify.

## Step 2: Verify netlify.toml Configuration

Your `netlify.toml` file has been created with the correct settings:
- Build command: `npm run build`
- Publish directory: `.output/public`
- Node version: 20 (required for Vite/Vue crypto.hash support)
- SSR redirect to Netlify Functions

## Step 3: Deploy to Netlify

### Option A: Connect via Git (Recommended)

1. Commit and push all changes:
```bash
git add .
git commit -m "Fix: Remove hardcoded credentials from documentation"
git push origin main
```

2. In Netlify:
   - Click "Add new site" → "Import an existing project"
   - Connect your Git provider (GitHub/GitLab/Bitbucket)
   - Select your repository
   - Netlify will auto-detect settings from `netlify.toml`
   - Click "Deploy site"

### Option B: Manual Deploy via CLI

1. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

2. Login to Netlify:
```bash
netlify login
```

3. Initialize and deploy:
```bash
netlify init
netlify deploy --prod
```

## Step 4: Set Up Your Database

### Using PlanetScale (Recommended for Netlify)

1. Sign up at [planetscale.com](https://planetscale.com)
2. Create a new database
3. Get connection credentials from the dashboard
4. Run the SQL schema from README.md in PlanetScale console

### Using Railway

1. Sign up at [railway.app](https://railway.app)
2. Create a new MySQL database
3. Get connection credentials
4. Connect and run the SQL schema

### Using Any MySQL Host

Make sure your MySQL database:
- Accepts connections from Netlify's IPs (or allows all IPs for MySQL)
- Has the correct schema (users, notes, attachments tables)
- Credentials are correctly set in Netlify environment variables

## Step 5: Verify Deployment

1. Wait for deployment to complete
2. Visit your Netlify site URL
3. Test the following:
   - ✅ Site loads without errors
   - ✅ Sign up creates a new user
   - ✅ Login works
   - ✅ Creating a note works
   - ✅ Editing and deleting notes works

## Troubleshooting

### Secret Scanner Still Triggered

If you still see secret scanner warnings:
1. Make sure you've pushed the latest changes
2. Check that no `.env` file is in your repository:
   ```bash
   git ls-files | grep .env
   ```
   Should only show `.env.example` (if it shows `.env`, remove it)

3. Remove cached build:
   - In Netlify: Site configuration → Build & deploy → Clear cache and retry deploy

### Database Connection Errors

- Verify all environment variables are set correctly in Netlify
- Check that your database accepts connections from external IPs
- Ensure the database schema is created (users, notes, attachments tables)
- Test credentials locally first

### Build Fails

- Check Node version (should be 18+)
- Verify all dependencies are in `package.json`
- Review build logs in Netlify dashboard
- Try building locally: `npm run build`

### 500 Errors in Production

- Check Netlify Function logs in the dashboard
- Verify JWT_SECRET is set
- Confirm database connection details are correct
- Make sure database has proper schema

## Database Schema Reference

Run this SQL in your production database:

```sql
CREATE DATABASE IF NOT EXISTS markdown_notes;
USE markdown_notes;

CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content MEDIUMTEXT,
  tags JSON,
  is_favorite BOOLEAN DEFAULT FALSE,
  folder VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FULLTEXT INDEX idx_search (title, content)
);

CREATE TABLE IF NOT EXISTS attachments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  note_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT,
  mime_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);
```

## Security Best Practices

✅ **DO:**
- Use strong, unique passwords for database
- Generate random JWT secrets (minimum 32 characters)
- Set `NODE_ENV=production` in production
- Keep environment variables only in Netlify dashboard
- Regularly rotate JWT secrets

❌ **DON'T:**
- Commit `.env` file to Git
- Share JWT secrets
- Use simple passwords
- Hard-code credentials in source files

## Next Steps

Once deployed:
1. Configure a custom domain (optional)
2. Enable HTTPS (automatically enabled by Netlify)
3. Set up deployment notifications
4. Configure build hooks for auto-deploy on push

## Support

If you encounter issues:
1. Check Netlify build logs
2. Review Netlify Function logs
3. Verify environment variables
4. Test database connection
5. Review this guide's troubleshooting section

Happy deploying! 🚀

