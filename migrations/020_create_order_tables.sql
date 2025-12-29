-- ============================================
-- Migration 020: Create Normalized Order Tables
-- Creates dedicated tables for user-specific ordering
-- Replaces JSON columns: folder_order, note_order, space_order
-- ============================================

-- Table for notebook (formerly space) ordering
CREATE TABLE user_notebook_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  notebook_id INT NOT NULL,
  position INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE,

  -- Ensure one notebook appears only once per user
  UNIQUE KEY unique_user_notebook (user_id, notebook_id),

  -- Index for efficient position-based queries
  INDEX idx_user_position (user_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Stores user-specific notebook ordering';

-- Table for section (formerly folder) ordering within notebooks
CREATE TABLE user_section_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  section_id INT NOT NULL,
  notebook_id INT NOT NULL,
  position INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
  FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE,

  -- Ensure one section appears only once per user/notebook context
  UNIQUE KEY unique_user_section_notebook (user_id, section_id, notebook_id),

  -- Index for efficient position-based queries within a notebook
  INDEX idx_user_notebook_position (user_id, notebook_id, position),
  INDEX idx_section (section_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Stores user-specific section ordering within notebooks';

-- Table for page (formerly note) ordering within sections
CREATE TABLE user_page_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  page_id VARCHAR(36) NOT NULL,
  section_id INT NULL,
  position INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,

  -- Ensure one page appears only once per user/section context
  -- section_id NULL represents root-level pages
  UNIQUE KEY unique_user_page_section (user_id, page_id, section_id),

  -- Index for efficient position-based queries within a section
  INDEX idx_user_section_position (user_id, section_id, position),
  INDEX idx_page (page_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Stores user-specific page ordering within sections (NULL section_id = root pages)';
