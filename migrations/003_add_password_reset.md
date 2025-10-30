# Password Reset Migration (003)

This migration adds password reset functionality to the users table.

## What it does

Adds two new columns to the `users` table:
- `temporary_password` - Stores hashed temporary password
- `temporary_password_expires_at` - Expiration timestamp for temporary password

## How to run

### Option 1: Using the migration script
```bash
cd migrations
node run-migration.js 003_add_password_reset.sql
```

### Option 2: Run SQL directly
Connect to your MySQL database and execute:
```sql
ALTER TABLE users 
ADD COLUMN temporary_password VARCHAR(255) DEFAULT NULL,
ADD COLUMN temporary_password_expires_at DATETIME DEFAULT NULL;

CREATE INDEX idx_users_temp_password_expires ON users(temporary_password_expires_at);
```

## Prerequisites

- Database must be running
- Environment variables must be set in `.env`:
  - `DB_HOST`
  - `DB_PORT`
  - `DB_USER`
  - `DB_PASSWORD`
  - `DB_NAME`
  - `BREVO_API_KEY` (for sending emails)

## Testing

After running the migration, test the forgot password feature:
1. Go to the login page
2. Click "Forgot password?"
3. Enter a valid email address
4. Check your email for the temporary password
5. Login with the temporary password
6. The temporary password will be cleared after successful login


