import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

// Simulate canAccessContent function
async function canAccessContent(contentUserId, requestUserId, connection) {
  if (contentUserId === requestUserId) return true;

  const [invitation] = await connection.query(
    'SELECT id FROM user_invitations WHERE owner_id = ? AND invited_user_id = ? AND status = "accepted"',
    [contentUserId, requestUserId]
  );

  return invitation && invitation.length > 0;
}

async function testDeleteAccess() {
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

    const joyceId = 8;
    const elliottId = 6;

    console.log('=== TEST: Can Joyce delete Elliott\'s notebook? ===\n');

    // Get one of Elliott's notebooks
    const [elliottNotebooks] = await connection.query(
      'SELECT id, user_id, name FROM notebooks WHERE user_id = ? LIMIT 1',
      [elliottId]
    );

    if (elliottNotebooks.length === 0) {
      console.log('No notebooks found for Elliott');
      return;
    }

    const testNotebook = elliottNotebooks[0];
    console.log(`Test notebook: ${testNotebook.name} (ID: ${testNotebook.id}, Owner: ${testNotebook.user_id})`);

    // Test canAccessContent
    const hasAccess = await canAccessContent(testNotebook.user_id, joyceId, connection);
    console.log(`\ncanAccessContent(${testNotebook.user_id}, ${joyceId}) = ${hasAccess}`);

    if (hasAccess) {
      console.log('✅ Joyce HAS access to delete Elliott\'s notebook');
    } else {
      console.log('❌ Joyce DOES NOT have access to delete Elliott\'s notebook');
      console.log('\nLet me check the invitations:');
      const [invitations] = await connection.query(
        'SELECT * FROM user_invitations WHERE (owner_id = ? AND invited_user_id = ?) OR (owner_id = ? AND invited_user_id = ?)',
        [elliottId, joyceId, joyceId, elliottId]
      );
      console.table(invitations);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testDeleteAccess();
