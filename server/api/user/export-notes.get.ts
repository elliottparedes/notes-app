import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import { htmlToMarkdown } from '~/server/utils/markdown';
import archiver from 'archiver';

interface NoteRow {
  id: number;
  title: string;
  content: string | null;
  section_id: number | null;
  section_name: string | null;
  notebook_name: string | null;
  created_at: Date;
  updated_at: Date;
}

interface SectionRow {
  id: number;
  name: string;
  parent_id: number | null;
  notebook_id: number | null;
}

interface NotebookRow {
  id: number;
  name: string;
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);

  try {
    // Fetch all notes with section (folder) and notebook (space) info
    const notes = await executeQuery<NoteRow[]>(`
      SELECT
        p.id,
        p.title,
        p.content,
        p.section_id,
        s.name as section_name,
        n.name as notebook_name,
        p.created_at,
        p.updated_at
      FROM pages p
      LEFT JOIN sections s ON p.section_id = s.id
      LEFT JOIN notebooks n ON s.notebook_id = n.id
      WHERE p.user_id = ?
      ORDER BY n.name, s.name, p.title
    `, [userId]);

    // Fetch all sections (folders) to build path hierarchy
    const sections = await executeQuery<SectionRow[]>(`
      SELECT id, name, parent_id, notebook_id
      FROM sections
      WHERE user_id = ?
    `, [userId]);

    // Fetch all notebooks (spaces)
    const notebooks = await executeQuery<NotebookRow[]>(`
      SELECT id, name
      FROM notebooks
      WHERE user_id = ?
    `, [userId]);

    // Build section (folder) path map
    const sectionMap = new Map<number, SectionRow>();
    sections.forEach(s => sectionMap.set(s.id, s));

    // Build notebook (space) name map
    const notebookMap = new Map<number, string>();
    notebooks.forEach(n => notebookMap.set(n.id, n.name));

    function getSectionPath(sectionId: number | null): string {
      if (!sectionId) return '';

      const parts: string[] = [];
      let currentId: number | null = sectionId;
      let notebookId: number | null = null;

      // Build folder path from section hierarchy
      while (currentId) {
        const section = sectionMap.get(currentId);
        if (!section) break;
        parts.unshift(sanitizeFileName(section.name));
        notebookId = section.notebook_id;
        currentId = section.parent_id;
      }

      // Prepend notebook (space) name if exists
      if (notebookId) {
        const notebookName = notebookMap.get(notebookId);
        if (notebookName) {
          parts.unshift(sanitizeFileName(notebookName));
        }
      }

      return parts.join('/');
    }

    function sanitizeFileName(name: string): string {
      // Remove or replace characters that are invalid in file names
      return name
        .replace(/[<>:"/\\|?*]/g, '-')
        .replace(/\s+/g, ' ')
        .trim() || 'Untitled';
    }

    // Create zip archive - streams directly to response, no disk storage needed
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    // Handle archive errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      throw createError({
        statusCode: 500,
        message: 'Failed to create export archive'
      });
    });

    // Track file names to handle duplicates
    const usedPaths = new Set<string>();

    function getUniquePath(basePath: string): string {
      let path = basePath;
      let counter = 1;

      while (usedPaths.has(path.toLowerCase())) {
        const ext = '.md';
        const nameWithoutExt = basePath.slice(0, -ext.length);
        path = `${nameWithoutExt} (${counter})${ext}`;
        counter++;
      }

      usedPaths.add(path.toLowerCase());
      return path;
    }

    // Add each note to the archive
    for (const note of notes) {
      const sectionPath = getSectionPath(note.section_id);
      const fileName = sanitizeFileName(note.title || 'Untitled') + '.md';
      const fullPath = sectionPath ? `${sectionPath}/${fileName}` : fileName;
      const uniquePath = getUniquePath(fullPath);

      // Convert HTML content to markdown
      const markdownContent = note.content ? htmlToMarkdown(note.content) : '';

      // Create markdown file with frontmatter
      const frontmatter = [
        '---',
        `title: "${(note.title || 'Untitled').replace(/"/g, '\\"')}"`,
        `created: ${new Date(note.created_at).toISOString()}`,
        `updated: ${new Date(note.updated_at).toISOString()}`,
        note.notebook_name ? `space: "${note.notebook_name.replace(/"/g, '\\"')}"` : null,
        note.section_name ? `folder: "${note.section_name.replace(/"/g, '\\"')}"` : null,
        '---',
        '',
      ].filter(Boolean).join('\n');

      const fileContent = frontmatter + markdownContent;

      archive.append(fileContent, { name: uniquePath });
    }

    // Add a README file
    const readmeContent = `# Unfold Notes Export

Exported on: ${new Date().toISOString()}
Total notes: ${notes.length}

## Structure

Notes are organized by space and folder structure. Each note is saved as a markdown file with YAML frontmatter containing metadata.

The folder structure is: \`Space Name/Folder Name/Note Title.md\`

## Frontmatter Fields

- \`title\`: The note title
- \`created\`: Creation timestamp (ISO 8601)
- \`updated\`: Last update timestamp (ISO 8601)
- \`space\`: The space/notebook name (if any)
- \`folder\`: The folder/section name (if any)

## Importing to Other Apps

These markdown files are compatible with most note-taking apps including:
- Obsidian (drag and drop the extracted folder)
- Notion (via import)
- Bear
- iA Writer
- Typora
- Any text editor

---
Exported from Unfold Notes
`;

    archive.append(readmeContent, { name: 'README.md' });

    // Finalize the archive
    archive.finalize();

    // Set response headers
    const timestamp = new Date().toISOString().split('T')[0];
    setHeader(event, 'Content-Type', 'application/zip');
    setHeader(event, 'Content-Disposition', `attachment; filename="unfold-notes-export-${timestamp}.zip"`);

    // Return the archive stream directly - no files stored on server
    return archive;

  } catch (error: any) {
    console.error('Export notes error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to export notes'
    });
  }
});
