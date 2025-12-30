import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

async function testSharing() {
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

    // Test for Joyce (user 8)
    const joyceId = 8;
    console.log(`=== Testing for Joyce (user ${joyceId}) ===\n`);

    // Get shared user IDs
    console.log('Step 1: Get shared user IDs');
    const [sharedUsers] = await connection.query(
      'SELECT owner_id FROM user_invitations WHERE invited_user_id = ? AND status = "accepted"',
      [joyceId]
    );
    console.log('Shared users:', sharedUsers);
    const sharedUserIds = sharedUsers.map(r => r.owner_id);

    // Get all accessible user IDs
    const allAccessibleIds = [joyceId, ...sharedUserIds];
    console.log('\nStep 2: All accessible user IDs:', allAccessibleIds);

    // Get notes for all accessible users
    console.log('\nStep 3: Fetch notes for these users');
    const placeholders = allAccessibleIds.map(() => '?').join(',');
    const [notes] = await connection.query(
      `SELECT id, user_id, title, section_id FROM pages WHERE user_id IN (${placeholders}) ORDER BY updated_at DESC`,
      allAccessibleIds
    );
    console.log(`\nFound ${notes.length} notes total:`);

    // Count by user
    const countByUser = {};
    notes.forEach(note => {
      countByUser[note.user_id] = (countByUser[note.user_id] || 0) + 1;
    });
    console.log('Notes by user:', countByUser);

    // Show first 10 notes
    console.log('\nFirst 10 notes:');
    console.table(notes.slice(0, 10).map(n => ({
      user_id: n.user_id,
      title: n.title,
      section_id: n.section_id
    })));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testSharing();
