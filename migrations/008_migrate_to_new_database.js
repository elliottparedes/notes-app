/**
 * Database Migration Script
 * 
 * Migrates all data from old database to new database
 * 
 * Usage:
 *   node migrations/008_migrate_to_new_database.js
 * 
 * Make sure to set your environment variables:
 *   OLD_DB_HOST, OLD_DB_PORT, OLD_DB_USER, OLD_DB_PASSWORD, OLD_DB_NAME
 *   NEW_DB_HOST, NEW_DB_PORT, NEW_DB_USER, NEW_DB_PASSWORD, NEW_DB_NAME
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function migrateDatabase() {
  // Old database connection
  const oldDb = await mysql.createConnection({
    host: process.env.OLD_DB_HOST || '158.101.16.104',
    port: parseInt(process.env.OLD_DB_PORT || '3306'),
    user: process.env.OLD_DB_USER || 'mysql',
    password: process.env.OLD_DB_PASSWORD || '',
    database: process.env.OLD_DB_NAME || 'default',
    multipleStatements: true
  });

  // New database connection
  const newDb = await mysql.createConnection({
    host: process.env.DB_HOST || process.env.MYSQL_HOST || '155.117.44.112',
    port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '33066'),
    user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE_NAME || 'notes',
    multipleStatements: true
  });

  try {
    console.log('✅ Connected to both databases');
    
    // Ensure new database exists and has schema
    console.log('📋 Ensuring new database schema exists...');
    await ensureSchema(newDb);
    
    // Migrate tables in order (respecting foreign keys)
    console.log('🔄 Starting migration...\n');
    
    // 1. Users (no dependencies)
    console.log('1️⃣  Migrating users...');
    await migrateTable(oldDb, newDb, 'users', [
      'id', 'email', 'password_hash', 'name', 'folder_order', 
      'note_order', 'storage_used', 'user_type', 'created_at', 'updated_at'
    ], true); // Preserve IDs
    
    // 2. Spaces (depends on users)
    console.log('2️⃣  Migrating spaces...');
    await migrateTable(oldDb, newDb, 'spaces', [
      'id', 'user_id', 'name', 'color', 'icon', 'created_at', 'updated_at'
    ], true);
    
    // 3. Folders (depends on users and spaces)
    console.log('3️⃣  Migrating folders...');
    await migrateTable(oldDb, newDb, 'folders', [
      'id', 'user_id', 'space_id', 'name', 'parent_id', 'created_at', 'updated_at'
    ], true);
    
    // 4. Notes (depends on users and folders)
    console.log('4️⃣  Migrating notes...');
    await migrateTable(oldDb, newDb, 'notes', [
      'id', 'user_id', 'title', 'content', 'tags', 'is_favorite', 
      'folder', 'folder_id', 'created_at', 'updated_at'
    ], false); // UUIDs, don't preserve IDs
    
    // 5. Shared Notes (depends on notes and users)
    console.log('5️⃣  Migrating shared_notes...');
    await migrateTable(oldDb, newDb, 'shared_notes', [
      'id', 'note_id', 'owner_id', 'shared_with_user_id', 
      'permission', 'created_at', 'updated_at'
    ], false);
    
    // 6. Published Notes (depends on notes and users)
    console.log('6️⃣  Migrating published_notes...');
    await migrateTable(oldDb, newDb, 'published_notes', [
      'note_id', 'share_id', 'owner_id', 'is_active', 'created_at', 'updated_at'
    ], false);
    
    // 7. Published Folders (depends on folders and users)
    console.log('7️⃣  Migrating published_folders...');
    await migrateTable(oldDb, newDb, 'published_folders', [
      'folder_id', 'share_id', 'owner_id', 'is_active', 'created_at', 'updated_at'
    ], false);
    
    // 8. Published Spaces (depends on spaces and users)
    console.log('8️⃣  Migrating published_spaces...');
    await migrateTable(oldDb, newDb, 'published_spaces', [
      'space_id', 'share_id', 'owner_id', 'is_active', 'created_at', 'updated_at'
    ], false);
    
    // Skip attachments - we're removing file upload functionality
    
    console.log('\n✅ Migration completed successfully!');
    console.log('📊 Summary:');
    console.log('   - Users migrated');
    console.log('   - Spaces migrated');
    console.log('   - Folders migrated');
    console.log('   - Notes migrated');
    console.log('   - Shared notes migrated');
    console.log('   - Published notes migrated');
    console.log('   - Published folders migrated');
    console.log('   - Published spaces migrated');
    console.log('   - Attachments skipped (removing file upload feature)');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await oldDb.end();
    await newDb.end();
  }
}

async function ensureSchema(newDb) {
  // Create tables if they don't exist (simplified schema)
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(100),
      folder_order JSON,
      note_order JSON,
      storage_used BIGINT DEFAULT 0,
      user_type VARCHAR(50) DEFAULT 'individual',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS spaces (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      color VARCHAR(50),
      icon VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS folders (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      space_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      parent_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notes (
      id VARCHAR(36) PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      content MEDIUMTEXT,
      tags JSON,
      is_favorite BOOLEAN DEFAULT FALSE,
      folder VARCHAR(100),
      folder_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
      FULLTEXT INDEX idx_search (title, content)
    );

    CREATE TABLE IF NOT EXISTS shared_notes (
      id INT PRIMARY KEY AUTO_INCREMENT,
      note_id VARCHAR(36) NOT NULL,
      owner_id INT NOT NULL,
      shared_with_user_id INT NOT NULL,
      permission ENUM('viewer', 'editor') DEFAULT 'viewer',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_share (note_id, shared_with_user_id)
    );

    CREATE TABLE IF NOT EXISTS published_notes (
      note_id VARCHAR(36) NOT NULL,
      share_id VARCHAR(36) NOT NULL PRIMARY KEY,
      owner_id INT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS published_folders (
      folder_id INT NOT NULL,
      share_id VARCHAR(36) NOT NULL PRIMARY KEY,
      owner_id INT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS published_spaces (
      space_id INT NOT NULL,
      share_id VARCHAR(36) NOT NULL PRIMARY KEY,
      owner_id INT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `;
  
  await newDb.query(schema);
  console.log('✅ Schema ensured');
}

async function migrateTable(oldDb, newDb, tableName, columns, preserveIds) {
  try {
    // Check if table exists in old DB
    const [tables] = await oldDb.query(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = DATABASE() AND table_name = ?`,
      [tableName]
    );
    
    if (tables[0].count === 0) {
      console.log(`   ⚠️  Table ${tableName} does not exist in old database, skipping...`);
      return;
    }
    
    // Get data from old DB
    const columnList = columns.join(', ');
    const [rows] = await oldDb.query(`SELECT ${columnList} FROM ${tableName}`);
    
    if (rows.length === 0) {
      console.log(`   ℹ️  No data in ${tableName}, skipping...`);
      return;
    }
    
    // Clear existing data in new DB (optional - comment out if you want to append)
    // await newDb.query(`DELETE FROM ${tableName}`);
    
    // Insert data into new DB
    if (rows.length > 0) {
      const placeholders = columns.map(() => '?').join(', ');
      
      // Process rows to handle JSON columns properly
      const values = rows.map(row => {
        return columns.map(col => {
          const value = row[col];
          // Handle JSON columns - if it's already a string that looks like JSON, parse and stringify it
          // Otherwise if it's an object, stringify it
          if ((col === 'folder_order' || col === 'note_order' || col === 'tags') && value !== null) {
            if (typeof value === 'string') {
              try {
                // Try to parse it first to ensure it's valid JSON
                const parsed = JSON.parse(value);
                return JSON.stringify(parsed);
              } catch {
                // If parsing fails, return as is (might be NULL string or invalid JSON)
                return value === 'NULL' ? null : value;
              }
            } else if (typeof value === 'object') {
              return JSON.stringify(value);
            }
          }
          return value;
        });
      });
      
      // Insert in batches to avoid query size limits
      const batchSize = 100;
      for (let i = 0; i < values.length; i += batchSize) {
        const batch = values.slice(i, i + batchSize);
        const batchQuery = `INSERT IGNORE INTO ${tableName} (${columnList}) VALUES ${batch.map(() => `(${placeholders})`).join(', ')}`;
        await newDb.query(batchQuery, batch.flat());
      }
      
      console.log(`   ✅ Migrated ${rows.length} rows from ${tableName}`);
    }
  } catch (error) {
    console.error(`   ❌ Error migrating ${tableName}:`, error.message);
    throw error;
  }
}

migrateDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

