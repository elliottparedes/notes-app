-- ============================================
-- Migration 022: Create API Keys Table
-- Enables users to create API keys for programmatic access
-- ============================================

CREATE TABLE user_api_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  key_name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  scopes JSON NOT NULL DEFAULT ('["read"]'),
  request_count INT DEFAULT 0,
  last_used_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  -- Unique hash prevents duplicate keys
  UNIQUE KEY unique_key_hash (key_hash),

  -- Indexes for efficient lookups
  INDEX idx_user_id (user_id),
  INDEX idx_key_prefix (key_prefix),
  INDEX idx_active (is_active, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Stores user API keys for programmatic access with scopes and rate limiting';
