import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

async function checkInvitations() {
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

    // Check invitations
    console.log('=== USER INVITATIONS ===');
    const [invitations] = await connection.query(
      'SELECT * FROM user_invitations ORDER BY created_at DESC'
    );
    console.table(invitations);

    // Check users
    console.log('\n=== USERS ===');
    const [users] = await connection.query(
      'SELECT id, email, name FROM users'
    );
    console.table(users);

    // Check note counts per user
    console.log('\n=== NOTE COUNTS PER USER ===');
    const [noteCounts] = await connection.query(
      'SELECT user_id, COUNT(*) as note_count FROM pages GROUP BY user_id'
    );
    console.table(noteCounts);

    // Check sample notes
    console.log('\n=== SAMPLE NOTES ===');
    const [notes] = await connection.query(
      'SELECT id, user_id, title, section_id, modified_by_id, modified_by_name FROM pages ORDER BY created_at DESC LIMIT 10'
    );
    console.table(notes);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkInvitations();
