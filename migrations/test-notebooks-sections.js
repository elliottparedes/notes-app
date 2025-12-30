import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

async function testNotebooksAndSections() {
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
    const allAccessibleIds = [joyceId, elliottId];

    // Test notebooks
    console.log('=== NOTEBOOKS ===');
    const placeholders = allAccessibleIds.map(() => '?').join(',');
    const [notebooks] = await connection.query(
      `SELECT id, user_id, name FROM notebooks WHERE user_id IN (${placeholders})`,
      allAccessibleIds
    );
    console.log(`Total notebooks: ${notebooks.length}`);
    const notebooksByUser = {};
    notebooks.forEach(n => notebooksByUser[n.user_id] = (notebooksByUser[n.user_id] || 0) + 1);
    console.log('Notebooks by user:', notebooksByUser);
    console.table(notebooks.slice(0, 10));

    // Test sections
    console.log('\n=== SECTIONS ===');
    const [sections] = await connection.query(
      `SELECT id, user_id, name, notebook_id FROM sections WHERE user_id IN (${placeholders})`,
      allAccessibleIds
    );
    console.log(`Total sections: ${sections.length}`);
    const sectionsByUser = {};
    sections.forEach(s => sectionsByUser[s.user_id] = (sectionsByUser[s.user_id] || 0) + 1);
    console.log('Sections by user:', sectionsByUser);
    console.table(sections.slice(0, 10));

    // Check which section_ids the notes belong to
    console.log('\n=== NOTES SECTION DISTRIBUTION ===');
    const [notesSectionDist] = await connection.query(
      `SELECT p.section_id, s.name as section_name, s.user_id as section_owner, COUNT(*) as note_count
       FROM pages p
       LEFT JOIN sections s ON p.section_id = s.id
       WHERE p.user_id IN (${placeholders})
       GROUP BY p.section_id, s.name, s.user_id
       ORDER BY note_count DESC
       LIMIT 15`,
      allAccessibleIds
    );
    console.table(notesSectionDist);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testNotebooksAndSections();
