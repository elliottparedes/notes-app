-- Add user_id column to attachments table
-- This column tracks which user uploaded the file for quota management

ALTER TABLE attachments 
ADD COLUMN user_id INT NOT NULL 
COMMENT 'User who uploaded the file' 
AFTER note_id;

-- Add foreign key constraint
ALTER TABLE attachments 
ADD CONSTRAINT fk_attachments_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX idx_attachments_user_id ON attachments(user_id);

-- Update existing attachments with user_id from their parent note
-- This assumes all existing attachments belong to the note owner
UPDATE attachments a
INNER JOIN notes n ON a.note_id = n.id
SET a.user_id = n.user_id
WHERE a.user_id IS NULL OR a.user_id = 0;

