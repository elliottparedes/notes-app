import type { Folder, Note } from '~/types';

export function isUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.includes('/') || value.startsWith('http');
}

export function getSpaceFolders(spaceId: number, folders: Folder[]) {
  return folders.filter(f => f.space_id === spaceId);
}

export function getFolderNoteCount(folderId: number, notes: Note[]) {
  return notes.filter(n => n.folder_id === folderId && !n.share_permission).length;
}
