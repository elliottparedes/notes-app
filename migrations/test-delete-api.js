import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

async function testDeleteAPI() {
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

    console.log('=== Simulating Delete Request ===\n');

    // Get Elliott's first notebook
    const [notebooks] = await connection.query(
      'SELECT id, user_id, name FROM notebooks WHERE user_id = ? LIMIT 1',
      [elliottId]
    );

    if (notebooks.length === 0) {
      console.log('No notebooks found');
      return;
    }

    const testNotebook = notebooks[0];
    console.log(`Target notebook: ${testNotebook.name} (ID: ${testNotebook.id}, Owner: ${testNotebook.user_id})`);
    console.log(`Request from: Joyce (ID: ${joyceId})\n`);

    // Step 1: Check if notebook exists
    console.log('Step 1: Check if notebook exists');
    const [checkNotebooks] = await connection.query(
      'SELECT id, user_id FROM notebooks WHERE id = ?',
      [testNotebook.id]
    );
    console.log(`  Found: ${checkNotebooks.length > 0 ? 'Yes' : 'No'}`);
    if (checkNotebooks.length > 0) {
      console.log(`  Owner ID: ${checkNotebooks[0].user_id}`);
    }

    // Step 2: Check access
    console.log('\nStep 2: Check if Joyce has access');
    const notebookOwnerId = checkNotebooks[0].user_id;
    const [invitation] = await connection.query(
      'SELECT id FROM user_invitations WHERE owner_id = ? AND invited_user_id = ? AND status = "accepted"',
      [notebookOwnerId, joyceId]
    );
    const hasAccess = notebookOwnerId === joyceId || (invitation && invitation.length > 0);
    console.log(`  Has access: ${hasAccess ? 'Yes ✅' : 'No ❌'}`);

    if (!hasAccess) {
      console.log('\n❌ Access would be denied!');
      return;
    }

    // Step 3: Check if it's Joyce's only space
    console.log('\nStep 3: Check if this is Joyce\'s only owned notebook');
    const [joyceNotebooks] = await connection.query(
      'SELECT id FROM notebooks WHERE user_id = ?',
      [joyceId]
    );
    console.log(`  Joyce's owned notebooks: ${joyceNotebooks.length}`);
    console.log(`  Is deleting own notebook: ${notebookOwnerId === joyceId ? 'Yes' : 'No'}`);

    if (notebookOwnerId === joyceId && joyceNotebooks.length <= 1) {
      console.log('  ❌ Would fail: Cannot delete last remaining space');
      return;
    } else {
      console.log('  ✅ Can proceed with deletion');
    }

    // Step 4: Show what would be deleted
    console.log('\nStep 4: What would be deleted:');

    const [sections] = await connection.query(
      'SELECT id FROM sections WHERE notebook_id = ?',
      [testNotebook.id]
    );
    console.log(`  - Sections in notebook: ${sections.length}`);

    if (sections.length > 0) {
      const sectionIds = sections.map(s => s.id);
      const placeholders = sectionIds.map(() => '?').join(',');
      const [notes] = await connection.query(
        `SELECT id FROM pages WHERE section_id IN (${placeholders})`,
        sectionIds
      );
      console.log(`  - Notes in those sections: ${notes.length}`);
    }

    console.log('\n✅ All checks passed! Delete would succeed.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testDeleteAPI();
