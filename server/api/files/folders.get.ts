import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const startTime = Date.now();
  console.log('[FOLDERS API] Starting fetch folders...');

  const userId = await requireAuth(event);
  const query = getQuery(event);
  const parentPath = (query.parent as string) || '/';

  console.log(`[FOLDERS API] Auth complete (${Date.now() - startTime}ms), userId: ${userId}, parent: ${parentPath}`);

  try {
    // Get all unique folder paths for this user
    // Include both folders with files and folder markers (.folder files)
    const queryStart = Date.now();
    const rows = await executeQuery<{ folder_path: string }[]>(
      `SELECT DISTINCT folder_path
       FROM files
       WHERE user_id = ? AND folder_path LIKE ? AND folder_path != ?
       ORDER BY folder_path`,
      [userId, `${parentPath === '/' ? '' : parentPath}%`, parentPath]
    );
    console.log(`[FOLDERS API] Database query complete (${Date.now() - queryStart}ms), found ${rows.length} distinct paths`);

    // Extract immediate subfolders
    const processStart = Date.now();
    const folders = new Set<string>();
    const parentParts = parentPath === '/' ? [] : parentPath.split('/').filter(Boolean);
    const parentDepth = parentParts.length;

    rows.forEach(row => {
      const parts = row.folder_path.split('/').filter(Boolean);
      if (parts.length > parentDepth) {
        // Build the immediate subfolder path
        const folderPath = '/' + parts.slice(0, parentDepth + 1).join('/');
        folders.add(folderPath);
      }
    });
    console.log(`[FOLDERS API] Processing complete (${Date.now() - processStart}ms), extracted ${folders.size} folders`);

    const result = {
      folders: Array.from(folders).map(path => {
        const parts = path.split('/').filter(Boolean);
        return {
          path,
          name: parts[parts.length - 1] || 'Root',
        };
      }).sort((a, b) => a.name.localeCompare(b.name)),
    };

    console.log(`[FOLDERS API] Total time: ${Date.now() - startTime}ms`);
    return result;
  } catch (error: unknown) {
    console.error('Fetch folders error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch folders'
    });
  }
});

