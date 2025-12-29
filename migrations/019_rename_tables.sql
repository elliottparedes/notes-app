-- ============================================
-- Migration 019: Rename Tables
-- Renames tables to more intuitive naming:
--   spaces -> notebooks
--   folders -> sections
--   notes -> pages
-- ============================================

-- Rename primary tables
RENAME TABLE spaces TO notebooks;
RENAME TABLE folders TO sections;
RENAME TABLE notes TO pages;

-- Rename related tables
RENAME TABLE published_notes TO published_pages;
RENAME TABLE published_folders TO published_sections;
RENAME TABLE published_spaces TO published_notebooks;
RENAME TABLE shared_notes TO shared_pages;

-- Update foreign key column names in renamed tables for consistency
-- This doesn't change the references, just makes column names clearer

-- Update sections table (formerly folders)
ALTER TABLE sections CHANGE COLUMN space_id notebook_id INT NOT NULL;

-- Update pages table (formerly notes)
ALTER TABLE pages CHANGE COLUMN folder_id section_id INT;

-- Update kanban_cards table
ALTER TABLE kanban_cards CHANGE COLUMN folder_id section_id INT;
ALTER TABLE kanban_cards CHANGE COLUMN space_id notebook_id INT;

-- Update published_pages table (formerly published_notes)
ALTER TABLE published_pages CHANGE COLUMN note_id page_id VARCHAR(36) NOT NULL;

-- Update published_sections table (formerly published_folders)
ALTER TABLE published_sections CHANGE COLUMN folder_id section_id INT NOT NULL;

-- Update published_notebooks table (formerly published_spaces)
ALTER TABLE published_notebooks CHANGE COLUMN space_id notebook_id INT NOT NULL;

-- Update shared_pages table (formerly shared_notes)
ALTER TABLE shared_pages CHANGE COLUMN note_id page_id VARCHAR(36) NOT NULL;

-- Add tracking column to users for migration status
ALTER TABLE users ADD COLUMN orders_migrated_at TIMESTAMP NULL
COMMENT 'Timestamp when user order data was migrated to normalized tables';
