-- Safe migration to convert note IDs from INT to UUID (VARCHAR(36))
-- This version checks for existing columns and constraints

-- Step 1: Add a temporary UUID column (if it doesn't exist)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'notes' 
                   AND COLUMN_NAME = 'new_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE notes ADD COLUMN new_id VARCHAR(36)', 'SELECT "Column new_id already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Generate UUIDs for existing notes (only for null values)
UPDATE notes SET new_id = UUID() WHERE new_id IS NULL;

-- Step 3: Drop foreign key constraint from attachments table (if it exists)
SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                  WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'attachments'
                  AND CONSTRAINT_NAME = 'attachments_ibfk_1'
                  AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE attachments DROP FOREIGN KEY attachments_ibfk_1', 'SELECT "Foreign key attachments_ibfk_1 does not exist"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 4: Add temporary column to attachments (if it doesn't exist)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'attachments' 
                   AND COLUMN_NAME = 'new_note_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE attachments ADD COLUMN new_note_id VARCHAR(36)', 'SELECT "Column new_note_id already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 5: Update attachments to use new UUIDs
UPDATE attachments a
INNER JOIN notes n ON a.note_id = n.id
SET a.new_note_id = n.new_id
WHERE a.new_note_id IS NULL;

-- Step 6: Remove AUTO_INCREMENT before dropping primary key
ALTER TABLE notes MODIFY id INT NOT NULL;

-- Step 7: Drop old columns and constraints
ALTER TABLE notes DROP PRIMARY KEY;
ALTER TABLE notes DROP COLUMN id;
ALTER TABLE attachments DROP COLUMN note_id;

-- Step 8: Rename new columns to final names
ALTER TABLE notes CHANGE new_id id VARCHAR(36) NOT NULL;
ALTER TABLE attachments CHANGE new_note_id note_id VARCHAR(36) NOT NULL;

-- Step 9: Add back primary key and foreign key
ALTER TABLE notes ADD PRIMARY KEY (id);
ALTER TABLE attachments ADD CONSTRAINT fk_attachments_note_id 
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE;

-- Step 10: Add index on attachments.note_id for performance
CREATE INDEX idx_attachments_note_id ON attachments(note_id);

