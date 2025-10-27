# Quick Start Guide

Get your Markdown Notes app up and running in 5 minutes!

## Prerequisites Check

```bash
# Check Node.js version (need 18+)
node --version

# Check MySQL is installed
mysql --version
```

## 1. Install Dependencies

```bash
npm install
```

## 2. Set Up Database

```bash
# Login to MySQL
mysql -u root -p

# Run these commands:
CREATE DATABASE markdown_notes;
USE markdown_notes;

# Copy and paste the entire schema from README.md or run:
source schema.sql  # if you have the schema in a file
```

## 3. Configure Environment

Copy the example environment file and add your credentials:

```bash
cp .env.example .env
```

Then edit `.env` with your actual database credentials and JWT secret. See `.env.example` for all required variables.

## 4. Start the App

```bash
npm run dev
```

## 5. Open Browser

Navigate to: `http://localhost:3000`

## First Steps

1. Click "Sign up" to create an account
2. Enter your email and password
3. Click "Create Account"
4. You'll be redirected to the dashboard
5. Click "New Note" to create your first markdown note!

## Common Commands

```bash
# Development
npm run dev              # Start dev server

# Production
npm run build            # Build for production
npm run preview          # Preview production build

# Maintenance
npm install              # Install/update dependencies
npm run postinstall      # Regenerate Nuxt types
```

## File Structure Overview

```
markdown-notes-app/
├── models/              # TypeScript types (User, Note, etc.)
├── stores/              # Pinia stores (auth, notes)
├── pages/               # Vue pages (login, signup, dashboard, note editor)
├── middleware/          # Route guards (auth, guest)
├── server/              # Backend API
│   ├── api/            # API endpoints (auth, notes)
│   └── utils/          # Server utilities (db, jwt, auth)
├── plugins/            # Nuxt plugins
└── app.vue             # Main app component
```

## Troubleshooting

### Can't connect to database?
- Check MySQL is running: `mysql -u root -p`
- Verify `.env` credentials match your MySQL setup
- Ensure database exists: `SHOW DATABASES;`

### Port 3000 already in use?
```bash
npm run dev -- --port 3001
```

### Module errors?
```bash
rm -rf node_modules .nuxt
npm install
npm run dev
```

## Next Steps

- Read `SETUP.md` for detailed setup instructions
- Read `README.md` for full documentation
- Explore markdown features in the note editor
- Try organizing notes with folders and tags
- Mark important notes as favorites

---

**Need help?** Check the full documentation in `README.md` and `SETUP.md`

