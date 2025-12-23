import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runSpecificMigration() {
  const connection = await createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'notes_app',
    multipleStatements: true
  });

  try {
    console.log('Connected to database');
    
    const migrationFile = '015_add_kanban_fields.sql';
    const filePath = join(__dirname, migrationFile);
    console.log(`Reading migration file: ${filePath}`);
    
    const sql = readFileSync(filePath, 'utf8');
    
    console.log(`Executing SQL: ${sql}`);
    await connection.query(sql);
    
    // Update migrations table to mark it as run (optional, but good practice if we fix the runner later)
    await connection.query('INSERT INTO migrations (name) VALUES (?)', [migrationFile]);
    
    console.log('Migration executed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

runSpecificMigration();