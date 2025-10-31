/**
 * Database Migration Runner
 * 
 * This script runs database migrations to update the schema.
 * 
 * Usage:
 *   node migrations/run-migration.js
 * 
 * Make sure to set your environment variables before running:
 *   - DB_HOST
 *   - DB_PORT
 *   - DB_USER
 *   - DB_PASSWORD
 *   - DB_NAME
 */

import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'markdown_notes',
    multipleStatements: true
  });

  try {
    console.log('Connected to database');
    
    // Get migration file from command line argument or use default
    const migrationFile = process.argv[2] || '004_add_spaces.sql';
    const migrationName = migrationFile.replace('.sql', '');
    
    console.log(`Running migration: ${migrationFile}`);

    // Read the SQL file
    const sqlPath = join(__dirname, migrationFile);
    const sql = readFileSync(sqlPath, 'utf8');

    // Execute the migration
    await connection.query(sql);

    console.log('✅ Migration completed successfully!');
    
    if (migrationFile === '004_add_spaces.sql') {
      console.log('The spaces table has been created and space_id added to folders table.');
      console.log('All existing folders have been assigned to default "Personal" spaces.');
    } else if (migrationFile === '001_add_folder_order.sql') {
      console.log('The folder_order column has been added to the users table.');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    // Check if column already exists
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  Column already exists, skipping migration.');
    } else {
      throw error;
    }
  } finally {
    await connection.end();
  }
}

runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

