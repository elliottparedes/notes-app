import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function verifyMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('\n========================================');
    console.log('Migration Verification Report');
    console.log('========================================\n');

    // Check renamed tables
    const renamedTables = ['notebooks', 'sections', 'pages', 'published_notebooks', 'published_sections', 'published_pages', 'shared_pages'];
    console.log('✓ Checking renamed tables:');
    for (const table of renamedTables) {
      const [rows] = await connection.query('SHOW TABLES LIKE ?', [table]);
      if (rows.length > 0) {
        const [count] = await connection.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  ✓ ${table}: ${count[0].count} rows`);
      } else {
        console.log(`  ✗ ${table}: NOT FOUND`);
      }
    }

    // Check new order tables
    console.log('\n✓ Checking new order tables:');
    const orderTables = ['user_notebook_orders', 'user_section_orders', 'user_page_orders'];
    for (const table of orderTables) {
      const [rows] = await connection.query('SHOW TABLES LIKE ?', [table]);
      if (rows.length > 0) {
        const [count] = await connection.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  ✓ ${table}: ${count[0].count} rows`);
      } else {
        console.log(`  ✗ ${table}: NOT FOUND`);
      }
    }

    // Check API keys table
    console.log('\n✓ Checking API keys table:');
    const [apiKeysRows] = await connection.query('SHOW TABLES LIKE ?', ['user_api_keys']);
    if (apiKeysRows.length > 0) {
      const [count] = await connection.query('SELECT COUNT(*) as count FROM user_api_keys');
      console.log(`  ✓ user_api_keys: ${count[0].count} rows`);
    } else {
      console.log('  ✗ user_api_keys: NOT FOUND');
    }

    // Check orders_migrated_at column
    console.log('\n✓ Checking migration tracking:');
    const [users] = await connection.query('SELECT id, orders_migrated_at FROM users');
    const migratedCount = users.filter(u => u.orders_migrated_at !== null).length;
    console.log(`  ✓ ${migratedCount}/${users.length} users have orders_migrated_at timestamp`);

    // Check old JSON columns still exist
    console.log('\n✓ Checking legacy JSON columns (for backward compatibility):');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
      AND COLUMN_NAME IN ('folder_order', 'note_order', 'space_order')
    `, [process.env.DB_NAME]);

    for (const col of ['folder_order', 'note_order', 'space_order']) {
      const exists = columns.some(c => c.COLUMN_NAME === col);
      console.log(`  ${exists ? '✓' : '✗'} ${col}: ${exists ? 'EXISTS (safe to remove later)' : 'REMOVED'}`);
    }

    console.log('\n========================================');
    console.log('✅ Migration verification complete!');
    console.log('========================================\n');

  } finally {
    await connection.end();
  }
}

verifyMigration().catch(console.error);
