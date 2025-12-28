-- Add generated column for tags search to enable FULLTEXT search on tags
ALTER TABLE notes ADD COLUMN tags_text TEXT GENERATED ALWAYS AS (CAST(tags AS CHAR)) STORED;

-- Drop existing search index
ALTER TABLE notes DROP INDEX idx_search;

-- Create new search index including tags
ALTER TABLE notes ADD FULLTEXT INDEX idx_search (title, content, tags_text);
