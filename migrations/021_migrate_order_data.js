/**
 * Migration 021: Migrate Order Data
 *
 * Migrates user ordering data from JSON columns to normalized tables:
 * - space_order (JSON array) → user_notebook_orders table
 * - folder_order (JSON object) → user_section_orders table
 * - note_order (JSON object) → user_page_orders table
 *
 * Run with: node migrations/021_migrate_order_data.js
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function migrateOrderData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'notes_app'
  });

  try {
    console.log('Starting order data migration...');
    await connection.beginTransaction();

    // Fetch all users with their order data
    const [users] = await connection.query(
      'SELECT id, folder_order, note_order, space_order FROM users'
    );

    console.log(`Found ${users.length} users to migrate`);

    let migratedUsers = 0;
    let totalNotebookOrders = 0;
    let totalSectionOrders = 0;
    let totalPageOrders = 0;

    for (const user of users) {
      console.log(`\nMigrating user ${user.id}...`);

      // =========================================
      // Migrate notebook orders (space_order)
      // =========================================
      if (user.space_order) {
        try {
          const notebookIds = JSON.parse(user.space_order);

          if (Array.isArray(notebookIds)) {
            for (let position = 0; position < notebookIds.length; position++) {
              const notebookId = notebookIds[position];

              // Verify notebook exists
              const [notebooks] = await connection.query(
                'SELECT id FROM notebooks WHERE id = ? AND user_id = ?',
                [notebookId, user.id]
              );

              if (notebooks.length > 0) {
                await connection.query(
                  `INSERT IGNORE INTO user_notebook_orders (user_id, notebook_id, position)
                   VALUES (?, ?, ?)`,
                  [user.id, notebookId, position]
                );
                totalNotebookOrders++;
              } else {
                console.warn(`  Warning: Notebook ${notebookId} not found for user ${user.id}`);
              }
            }
            console.log(`  Migrated ${notebookIds.length} notebook orders`);
          }
        } catch (error) {
          console.error(`  Error migrating notebook order for user ${user.id}:`, error.message);
        }
      }

      // =========================================
      // Migrate section orders (folder_order)
      // =========================================
      if (user.folder_order) {
        try {
          const sectionOrder = JSON.parse(user.folder_order);

          if (typeof sectionOrder === 'object') {
            // folder_order format: {"root": [1,2,3]} or per-space
            let sectionCount = 0;

            for (const [key, sectionIds] of Object.entries(sectionOrder)) {
              if (!Array.isArray(sectionIds)) continue;

              for (let position = 0; position < sectionIds.length; position++) {
                const sectionId = sectionIds[position];

                // Get section's notebook_id
                const [sections] = await connection.query(
                  'SELECT notebook_id FROM sections WHERE id = ? AND user_id = ?',
                  [sectionId, user.id]
                );

                if (sections.length > 0) {
                  const notebookId = sections[0].notebook_id;

                  await connection.query(
                    `INSERT IGNORE INTO user_section_orders
                     (user_id, section_id, notebook_id, position)
                     VALUES (?, ?, ?, ?)`,
                    [user.id, sectionId, notebookId, position]
                  );

                  sectionCount++;
                  totalSectionOrders++;
                } else {
                  console.warn(`  Warning: Section ${sectionId} not found for user ${user.id}`);
                }
              }
            }

            console.log(`  Migrated ${sectionCount} section orders`);
          }
        } catch (error) {
          console.error(`  Error migrating section order for user ${user.id}:`, error.message);
        }
      }

      // =========================================
      // Migrate page orders (note_order)
      // =========================================
      if (user.note_order) {
        try {
          const pageOrder = JSON.parse(user.note_order);

          if (typeof pageOrder === 'object') {
            // note_order format: {"folder_5": ["uuid1", "uuid2"], "root": ["uuid3"]}
            let pageCount = 0;

            for (const [folderKey, pageIds] of Object.entries(pageOrder)) {
              if (!Array.isArray(pageIds)) continue;

              // Determine section_id: "root" → null, "folder_N" → N
              let sectionId = null;
              if (folderKey !== 'root') {
                const match = folderKey.match(/folder_(\d+)/);
                if (match) {
                  sectionId = parseInt(match[1]);
                }
              }

              for (let position = 0; position < pageIds.length; position++) {
                const pageId = pageIds[position];

                // Verify page exists
                const [pages] = await connection.query(
                  'SELECT id FROM pages WHERE id = ? AND user_id = ?',
                  [pageId, user.id]
                );

                if (pages.length > 0) {
                  await connection.query(
                    `INSERT IGNORE INTO user_page_orders
                     (user_id, page_id, section_id, position)
                     VALUES (?, ?, ?, ?)`,
                    [user.id, pageId, sectionId, position]
                  );

                  pageCount++;
                  totalPageOrders++;
                } else {
                  console.warn(`  Warning: Page ${pageId} not found for user ${user.id}`);
                }
              }
            }

            console.log(`  Migrated ${pageCount} page orders`);
          }
        } catch (error) {
          console.error(`  Error migrating page order for user ${user.id}:`, error.message);
        }
      }

      // Mark user as migrated
      await connection.query(
        'UPDATE users SET orders_migrated_at = NOW() WHERE id = ?',
        [user.id]
      );

      migratedUsers++;
    }

    await connection.commit();

    console.log('\n========================================');
    console.log('Migration completed successfully!');
    console.log('========================================');
    console.log(`Users migrated: ${migratedUsers}/${users.length}`);
    console.log(`Total notebook orders: ${totalNotebookOrders}`);
    console.log(`Total section orders: ${totalSectionOrders}`);
    console.log(`Total page orders: ${totalPageOrders}`);
    console.log('========================================\n');

  } catch (error) {
    await connection.rollback();
    console.error('\n========================================');
    console.error('Migration FAILED:', error);
    console.error('========================================\n');
    throw error;
  } finally {
    await connection.end();
  }
}

// Run migration
migrateOrderData()
  .then(() => {
    console.log('Migration script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
