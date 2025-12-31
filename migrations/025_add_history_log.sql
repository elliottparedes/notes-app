-- Migration 025: Add History Log for Audit Trail
-- Tracks all changes to pages, notebooks, and sections with old/new values

CREATE TABLE IF NOT EXISTS history_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,

  -- Entity reference (polymorphic)
  entity_type ENUM('page', 'notebook', 'section') NOT NULL,
  entity_id VARCHAR(36) NOT NULL,

  -- User who made the change
  user_id INT NOT NULL,
  user_name VARCHAR(100) NOT NULL,

  -- Content owner (for multi-user/shared spaces filtering)
  owner_id INT NOT NULL,

  -- Action type
  action ENUM('create', 'update', 'delete') NOT NULL,

  -- Field that was changed (null for create/delete of entire entity)
  field_name VARCHAR(100) NULL,

  -- Values stored as JSON
  old_value LONGTEXT NULL,
  new_value LONGTEXT NULL,

  -- Timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_user (user_id),
  INDEX idx_owner (owner_id),
  INDEX idx_created_at (created_at),
  INDEX idx_action (action),

  -- Foreign keys
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
