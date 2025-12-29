import type { Folder, Note } from '~/types';

export function isUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.includes('/') || value.startsWith('http');
}

export function getSpaceFolders(notebookId: number, folders: Section[]) {
  return folders.filter(f => f.notebook_id === notebookId);
}

export function getFolderNoteCount(sectionId: number, notes: Page[]) {
  return notes.filter(n => n.section_id === sectionId && !n.share_permission).length;
}
