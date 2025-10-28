-- Add folder_order column to users table
-- This column stores the user's custom folder ordering as a JSON array

ALTER TABLE users 
ADD COLUMN folder_order JSON NULL 
COMMENT 'Custom folder ordering for the user' 
AFTER name;

-- The column is nullable so existing users will have NULL initially
-- When they first reorder folders, their preference will be saved

