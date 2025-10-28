# Database Migrations

This directory contains database migration scripts to update the schema.

## Running Migrations

### Method 1: Using the Migration Runner Script

```bash
node migrations/run-migration.js
```

This will automatically run the migration using your environment variables.

### Method 2: Manual SQL Execution

You can also run the SQL migration manually:

```bash
mysql -u your_username -p your_database < migrations/001_add_folder_order.sql
```

Or connect to your database and run:

```sql
source migrations/001_add_folder_order.sql;
```

## Available Migrations

### 001_add_folder_order.sql

Adds the `folder_order` column to the `users` table to store custom folder ordering.

**What it does:**
- Adds a JSON column `folder_order` to the `users` table
- The column is nullable (existing users will have NULL initially)
- When users reorder folders, their preference is saved to the database
- This enables folder order to sync across devices

## Environment Variables

Make sure these are set in your `.env` file:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=markdown_notes
```

## Rollback

If you need to remove the `folder_order` column:

```sql
ALTER TABLE users DROP COLUMN folder_order;
```

