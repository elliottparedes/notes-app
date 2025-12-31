-- Add created_by_name column to pages table for tracking original creator
ALTER TABLE pages
  ADD COLUMN created_by_name VARCHAR(100) NULL AFTER modified_by_name;

-- Populate created_by_name for existing pages using the users table
UPDATE pages p
  JOIN users u ON p.user_id = u.id
  SET p.created_by_name = u.name
  WHERE p.created_by_name IS NULL;
