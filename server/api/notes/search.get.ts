import type { Note } from '../../../models';
import { executeQuery, parseJsonField } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

interface NoteRow {
  id: string;
  user_id: number;
  title: string;
  content: string | null;
  tags: string | null;
  is_favorite: number;
  folder: string | null;
  folder_id: number | null;
  created_at: Date;
  updated_at: Date;
  share_permission: 'viewer' | 'editor' | null;
  is_shared: number;
  relevance_score?: number;
}

interface SearchResult extends Note {
  relevance_score: number;
  match_context?: string;
}

/**
 * Tokenize search query into words, handling phrases in quotes
 */
function tokenizeQuery(query: string): { phrases: string[]; words: string[] } {
  const trimmed = query.trim();
  if (!trimmed) return { phrases: [], words: [] };

  // Extract phrases in quotes
  const phraseRegex = /"([^"]+)"/g;
  const phrases: string[] = [];
  let match;
  let remainingQuery = trimmed;

  while ((match = phraseRegex.exec(trimmed)) !== null) {
    phrases.push(match[1].trim());
    remainingQuery = remainingQuery.replace(match[0], '');
  }

  // Extract individual words (excluding quoted phrases)
  const words = remainingQuery
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map(w => w.toLowerCase());

  return { phrases, words };
}

/**
 * Calculate relevance score for a note based on search query
 * Higher score = more relevant
 */
function calculateRelevanceScore(
  note: Note,
  query: string,
  queryLower: string,
  phrases: string[],
  words: string[]
): number {
  let score = 0;
  const titleLower = (note.title || '').toLowerCase();
  const contentLower = (note.content || '').toLowerCase().substring(0, 10000); // Limit content for performance
  const tags = note.tags || [];

  // Exact title match (highest priority)
  if (titleLower === queryLower) {
    score += 1000;
  } else if (titleLower.startsWith(queryLower)) {
    score += 800;
  } else if (titleLower.includes(queryLower)) {
    score += 600;
  }

  // Phrase matches (high priority)
  for (const phrase of phrases) {
    const phraseLower = phrase.toLowerCase();
    if (titleLower.includes(phraseLower)) {
      score += 500;
    } else if (contentLower.includes(phraseLower)) {
      score += 300;
    }
  }

  // Word matches in title (high priority)
  let titleWordMatches = 0;
  for (const word of words) {
    if (word.length < 2) continue; // Skip very short words
    if (titleLower.includes(word)) {
      titleWordMatches++;
      score += 400;
    }
  }
  // Bonus for matching all words in title
  if (words.length > 0 && titleWordMatches === words.length) {
    score += 200;
  }

  // Word matches in content (medium priority)
  let contentWordMatches = 0;
  for (const word of words) {
    if (word.length < 2) continue;
    if (contentLower.includes(word)) {
      contentWordMatches++;
      score += 100;
    }
  }
  // Bonus for matching all words in content
  if (words.length > 0 && contentWordMatches === words.length) {
    score += 50;
  }

  // Tag matches (medium priority)
  for (const word of words) {
    if (word.length < 2) continue;
    for (const tag of tags) {
      if (tag.toLowerCase().includes(word)) {
        score += 150;
        break;
      }
    }
  }

  // Recency boost (favor recently updated notes)
  const daysSinceUpdate = (Date.now() - new Date(note.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < 7) {
    score += 20;
  } else if (daysSinceUpdate < 30) {
    score += 10;
  }

  // Favorite boost
  if (note.is_favorite) {
    score += 5;
  }

  return score;
}

/**
 * Extract match context from content (snippet around first match)
 */
function extractMatchContext(content: string | null, query: string, words: string[]): string {
  if (!content) return '';

  // Strip HTML tags
  let text = content.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Try to find exact query match first
  let matchIndex = textLower.indexOf(queryLower);
  
  // If no exact match, try to find first word match
  if (matchIndex === -1 && words.length > 0) {
    for (const word of words) {
      if (word.length >= 2) {
        matchIndex = textLower.indexOf(word);
        if (matchIndex !== -1) break;
      }
    }
  }

  if (matchIndex === -1) {
    // No match found, return first 200 chars
    return text.substring(0, 200).trim();
  }

  // Extract context around match (100 chars before, 200 chars after)
  const start = Math.max(0, matchIndex - 100);
  const end = Math.min(text.length, matchIndex + query.length + 200);
  let context = text.substring(start, end);

  // Add ellipsis if needed
  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';

  return context.trim();
}

export default defineEventHandler(async (event): Promise<SearchResult[]> => {
  const userId = await requireAuth(event);
  const query = getQuery(event);
  const searchQuery = (query.q as string)?.trim() || '';

  if (!searchQuery || searchQuery.length < 1) {
    return [];
  }

  try {
    const { phrases, words } = tokenizeQuery(searchQuery);
    const queryLower = searchQuery.toLowerCase();
    
    // Build search conditions
    // For MySQL FULLTEXT, we use MATCH AGAINST for better performance
    // But we'll also do client-side ranking for better relevance
    
    // Escape special characters for LIKE queries (for phrase matching)
    const escapedQuery = searchQuery.replace(/[%_\\]/g, '\\$&');
    const escapedQueryLower = queryLower.replace(/[%_\\]/g, '\\$&');

    // Build WHERE conditions
    const conditions: string[] = [
      '(n.user_id = ? OR sn.shared_with_user_id IS NOT NULL)'
    ];

    // Use FULLTEXT search if we have words (not just phrases)
    if (words.length > 0) {
      // MySQL FULLTEXT requires at least 3 characters for words (or 4 for InnoDB)
      // So we'll use a combination of FULLTEXT and LIKE
      const fulltextWords = words.filter(w => w.length >= 3).join(' ');
      
      if (fulltextWords) {
        conditions.push(`(MATCH(n.title, n.content) AGAINST(? IN BOOLEAN MODE) OR n.title LIKE ? OR n.content LIKE ?)`);
      } else {
        // For short words, use LIKE
        const likePattern = `%${escapedQueryLower}%`;
        conditions.push(`(n.title LIKE ? OR n.content LIKE ?)`);
      }
    } else if (phrases.length > 0) {
      // Only phrases, use LIKE
      const likePattern = `%${escapedQueryLower}%`;
      conditions.push(`(n.title LIKE ? OR n.content LIKE ?)`);
    } else {
      // Fallback to LIKE
      const likePattern = `%${escapedQueryLower}%`;
      conditions.push(`(n.title LIKE ? OR n.content LIKE ?)`);
    }

    // Build the query
    let sql = `
      SELECT DISTINCT n.*, 
        sn.permission as share_permission,
        (SELECT COUNT(*) FROM shared_notes WHERE note_id = n.id) > 0 as is_shared
      FROM notes n
      LEFT JOIN shared_notes sn ON n.id = sn.note_id AND sn.shared_with_user_id = ?
      WHERE ${conditions.join(' AND ')}
    `;

    // Prepare parameters
    const params: any[] = [userId, userId];
    
    if (words.length > 0) {
      const fulltextWords = words.filter(w => w.length >= 3).join(' ');
      if (fulltextWords) {
        // Use FULLTEXT with boolean mode for better matching
        const fulltextQuery = fulltextWords.split(' ').map(w => `+${w}*`).join(' ');
        const likePattern = `%${escapedQueryLower}%`;
        params.push(fulltextQuery, likePattern, likePattern);
      } else {
        const likePattern = `%${escapedQueryLower}%`;
        params.push(likePattern, likePattern);
      }
    } else {
      const likePattern = `%${escapedQueryLower}%`;
      params.push(likePattern, likePattern);
    }

    // Execute query
    const rows = await executeQuery<NoteRow[]>(sql, params);

    // Transform and score results
    const results: SearchResult[] = rows.map((row: NoteRow) => {
      const note: Note = {
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        content: row.content,
        tags: parseJsonField<string[]>(row.tags),
        is_favorite: Boolean(row.is_favorite),
        folder: row.folder,
        folder_id: row.folder_id || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        is_shared: Boolean(row.is_shared),
        share_permission: row.share_permission || undefined
      };

      const relevanceScore = calculateRelevanceScore(note, searchQuery, queryLower, phrases, words);
      const matchContext = extractMatchContext(note.content, searchQuery, words);

      return {
        ...note,
        relevance_score: relevanceScore,
        match_context: matchContext
      };
    });

    // Sort by relevance score (descending) and then by updated_at (descending)
    results.sort((a, b) => {
      if (b.relevance_score !== a.relevance_score) {
        return b.relevance_score - a.relevance_score;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    // Return top 100 results
    return results.slice(0, 100);
  } catch (error: unknown) {
    console.error('Search notes error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to search notes'
    });
  }
});

