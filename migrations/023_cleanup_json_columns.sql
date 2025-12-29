-- ============================================
-- Migration 023: Cleanup JSON Columns
-- Removes deprecated JSON order columns from users table
--
-- WARNING: Only run this AFTER verifying that:
-- 1. Migration 021 completed successfully
-- 2. All order data is correctly in normalized tables
-- 3. Application is using normalized tables
-- 4. Everything has been working for at least 7 days
-- ============================================

-- Remove the old JSON columns
ALTER TABLE users DROP COLUMN folder_order;
ALTER TABLE users DROP COLUMN note_order;
ALTER TABLE users DROP COLUMN space_order;

-- Remove the migration tracking column (no longer needed)
ALTER TABLE users DROP COLUMN orders_migrated_at;
