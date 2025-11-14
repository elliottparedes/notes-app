-- Migration to flatten folder structure: Remove subfolders
-- This migration moves all notes from subfolders to their parent folders
-- and sets all folders' parent_id to NULL

-- Step 1: Move notes from subfolders to their parent folders
-- We process this iteratively, moving notes level by level from deepest to shallowest
-- This ensures notes from nested subfolders end up in the root folder
-- We'll do multiple passes (up to 10 levels deep should be enough)

-- Pass 1: Move notes from level 3 to level 2 (if exists)
UPDATE notes n
INNER JOIN folders f ON n.folder_id = f.id
INNER JOIN folders parent ON f.parent_id = parent.id
SET n.folder_id = f.parent_id
WHERE f.parent_id IS NOT NULL AND parent.parent_id IS NOT NULL;

-- Pass 2: Move notes from level 3 to level 2 again (handles deeper nesting)
UPDATE notes n
INNER JOIN folders f ON n.folder_id = f.id
INNER JOIN folders parent ON f.parent_id = parent.id
SET n.folder_id = f.parent_id
WHERE f.parent_id IS NOT NULL AND parent.parent_id IS NOT NULL;

-- Pass 3: Continue moving (handles up to 4 levels)
UPDATE notes n
INNER JOIN folders f ON n.folder_id = f.id
INNER JOIN folders parent ON f.parent_id = parent.id
SET n.folder_id = f.parent_id
WHERE f.parent_id IS NOT NULL AND parent.parent_id IS NOT NULL;

-- Pass 4: Continue moving (handles up to 5 levels)
UPDATE notes n
INNER JOIN folders f ON n.folder_id = f.id
INNER JOIN folders parent ON f.parent_id = parent.id
SET n.folder_id = f.parent_id
WHERE f.parent_id IS NOT NULL AND parent.parent_id IS NOT NULL;

-- Pass 5: Continue moving (handles up to 6 levels)
UPDATE notes n
INNER JOIN folders f ON n.folder_id = f.id
INNER JOIN folders parent ON f.parent_id = parent.id
SET n.folder_id = f.parent_id
WHERE f.parent_id IS NOT NULL AND parent.parent_id IS NOT NULL;

-- Final pass: Move notes from direct subfolders (level 2) to root folders (level 1)
UPDATE notes n
INNER JOIN folders f ON n.folder_id = f.id
SET n.folder_id = f.parent_id
WHERE f.parent_id IS NOT NULL;

-- Step 2: Set all folders' parent_id to NULL (make them all root-level)
UPDATE folders SET parent_id = NULL WHERE parent_id IS NOT NULL;

