import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

async function checkModifiedBy() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'notes_app',
      port: parseInt(process.env.DB_PORT || '3306')
    });

    console.log('Connected to database\n');

    // Check notes with modification tracking
    console.log('=== NOTES WITH MODIFICATION TRACKING ===');
    const [withTracking] = await connection.query(
      'SELECT id, title, user_id, modified_by_id, modified_by_name FROM pages WHERE modified_by_name IS NOT NULL ORDER BY updated_at DESC LIMIT 10'
    );
    console.log(`Notes with tracking: ${withTracking.length}`);
    if (withTracking.length > 0) {
      console.table(withTracking);
    }

    // Check notes without modification tracking
    console.log('\n=== NOTES WITHOUT MODIFICATION TRACKING ===');
    const [withoutTracking] = await connection.query(
      'SELECT id, title, user_id, modified_by_id, modified_by_name FROM pages WHERE modified_by_name IS NULL LIMIT 5'
    );
    console.log(`Notes without tracking: ${withoutTracking.length}`);
    if (withoutTracking.length > 0) {
      console.table(withoutTracking);
    }

    // Total stats
    const [stats] = await connection.query(
      'SELECT COUNT(*) as total, SUM(modified_by_name IS NOT NULL) as with_tracking, SUM(modified_by_name IS NULL) as without_tracking FROM pages'
    );
    console.log('\n=== STATS ===');
    console.table(stats);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkModifiedBy();
