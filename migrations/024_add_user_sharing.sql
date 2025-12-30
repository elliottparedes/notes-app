-- Migration 024: Add User-to-User Sharing
-- This migration adds the ability for users to invite others by email
-- and share all their content with them (bidirectional sharing)

-- Create user_invitations table for email-based invitations
CREATE TABLE IF NOT EXISTS user_invitations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  owner_id INT NOT NULL,
  invited_email VARCHAR(255) NOT NULL,
  invited_user_id INT NULL,
  status ENUM('pending', 'accepted') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_invitation (owner_id, invited_email),
  INDEX idx_email (invited_email),
  INDEX idx_owner (owner_id),
  INDEX idx_invited_user (invited_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add modification tracking to pages table
ALTER TABLE pages
  ADD COLUMN modified_by_id INT NULL,
  ADD COLUMN modified_by_name VARCHAR(100) NULL;

-- Add foreign key for modified_by_id
ALTER TABLE pages
  ADD CONSTRAINT fk_modified_by
  FOREIGN KEY (modified_by_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add index for modified_by_id
CREATE INDEX idx_modified_by ON pages(modified_by_id);
