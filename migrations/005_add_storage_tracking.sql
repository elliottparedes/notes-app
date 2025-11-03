-- Add storage_used column to users table
-- This column tracks the total bytes used by the user for file uploads
-- Default is 0, maximum allowed is 500MB (524288000 bytes)

ALTER TABLE users 
ADD COLUMN storage_used BIGINT DEFAULT 0 
COMMENT 'Total bytes used by user for file uploads' 
AFTER note_order;

-- The column defaults to 0 so existing users start with no storage used
-- Maximum quota is enforced at the application level (500MB = 524288000 bytes)

