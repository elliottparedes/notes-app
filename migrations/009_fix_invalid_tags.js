/**
 * Fix Invalid Tags Migration
 * 
 * This script fixes any invalid JSON in the tags column
 * that might contain illegal characters or malformed JSON
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function fixInvalidTags() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '155.117.44.112',
    port: parseInt(process.env.DB_PORT || '33066'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'notes',
    multipleStatements: true
  });

  try {
    console.log('✅ Connected to database');
    
    // Get all notes with tags
    const [notes] = await db.query(
      'SELECT id, tags FROM notes WHERE tags IS NOT NULL'
    );
    
    console.log(`📋 Found ${notes.length} notes with tags`);
    
    let fixed = 0;
    let errors = 0;
    
    for (const note of notes) {
      try {
        let tags = note.tags;
        
        // If tags is a string, try to parse it
        if (typeof tags === 'string') {
          try {
            // Try to parse as JSON
            const parsed = JSON.parse(tags);
            
            // If it's an array, validate and clean it
            if (Array.isArray(parsed)) {
              // Filter out any invalid tags (null, undefined, or non-string values)
              const cleaned = parsed
                .filter(tag => tag !== null && tag !== undefined && typeof tag === 'string')
                .map(tag => String(tag).trim())
                .filter(tag => tag.length > 0);
              
              // Only update if tags changed
              if (JSON.stringify(cleaned) !== JSON.stringify(parsed)) {
                const cleanedJson = cleaned.length > 0 ? JSON.stringify(cleaned) : null;
                await db.query(
                  'UPDATE notes SET tags = ? WHERE id = ?',
                  [cleanedJson, note.id]
                );
                fixed++;
                console.log(`   ✅ Fixed tags for note ${note.id}`);
              }
            } else {
              // If it's not an array, set to null
              await db.query(
                'UPDATE notes SET tags = NULL WHERE id = ?',
                [note.id]
              );
              fixed++;
              console.log(`   ✅ Removed invalid tags (not array) for note ${note.id}`);
            }
          } catch (parseError) {
            // If JSON parsing fails, set tags to null
            console.log(`   ⚠️  Invalid JSON in tags for note ${note.id}, setting to null`);
            await db.query(
              'UPDATE notes SET tags = NULL WHERE id = ?',
              [note.id]
            );
            fixed++;
          }
        } else if (tags !== null) {
          // If tags is not null and not a string, it might be an object
          // Try to convert it to a proper JSON array
          try {
            if (Array.isArray(tags)) {
              const cleaned = tags
                .filter(tag => tag !== null && tag !== undefined && typeof tag === 'string')
                .map(tag => String(tag).trim())
                .filter(tag => tag.length > 0);
              
              const cleanedJson = cleaned.length > 0 ? JSON.stringify(cleaned) : null;
              await db.query(
                'UPDATE notes SET tags = ? WHERE id = ?',
                [cleanedJson, note.id]
              );
              fixed++;
              console.log(`   ✅ Fixed tags for note ${note.id}`);
            } else {
              await db.query(
                'UPDATE notes SET tags = NULL WHERE id = ?',
                [note.id]
              );
              fixed++;
              console.log(`   ✅ Removed invalid tags (not array) for note ${note.id}`);
            }
          } catch (error) {
            errors++;
            console.error(`   ❌ Error fixing note ${note.id}:`, error.message);
          }
        }
      } catch (error) {
        errors++;
        console.error(`   ❌ Error processing note ${note.id}:`, error.message);
      }
    }
    
    console.log('\n✅ Tag cleanup completed!');
    console.log(`   - Fixed: ${fixed} notes`);
    console.log(`   - Errors: ${errors} notes`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await db.end();
  }
}

fixInvalidTags().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});



