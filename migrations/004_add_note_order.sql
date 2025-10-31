-- Add note_order column to users table
-- This column stores the user's custom note ordering within folders as a JSON object
-- Structure: { "folder_5": ["uuid1", "uuid2"], "root": ["uuid3"] }

ALTER TABLE users 
ADD COLUMN note_order JSON NULL 
COMMENT 'Custom note ordering within folders for the user' 
AFTER folder_order;

-- The column is nullable so existing users will have NULL initially
-- When they first reorder notes, their preference will be saved

