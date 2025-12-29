import type { Note } from '~/types';

export interface NoteLocation {
  spaceName?: string;
  folderName?: string;
}

export function useNotesFormatting() {
  const notesStore = useNotesStore();
  const foldersStore = useFoldersStore();
  const spacesStore = useSpacesStore();

  function formatDate(date: string | Date): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  }

  function formatTime(date: string | Date): string {
    if (!date) return '';

    let d = new Date(date);

    // If input is a string, we need to be careful about how it's parsed.
    // If it's a UTC string from DB but missing 'Z', append it.
    if (typeof date === 'string') {
      // Check if it looks like "YYYY-MM-DD HH:MM:SS" (MySQL default)
      if (date.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        d = new Date(date.replace(' ', 'T') + 'Z');
      }
      // Check if it looks like "YYYY-MM-DDTHH:MM:SS" but missing Z/offset
      else if (date.indexOf('T') !== -1 && !date.endsWith('Z') && !date.includes('+') && !date.match(/-\d{2}:\d{2}$/)) {
        d = new Date(date + 'Z');
      }
    }

    if (isNaN(d.getTime())) return '';

    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function formatHeaderDate(date: string | Date): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function getNoteLocation(note: Page): NoteLocation {
    if (!note.section_id) {
      return {};
    }

    const folder = foldersStore.getFolderById(note.section_id);
    if (!folder) {
      return {};
    }

    const space = spacesStore.spaces.find((s) => s.id === folder.notebook_id) || null;
    return {
      spaceName: space?.name,
      folderName: folder.name
    };
  }

  function getOrderedNotesForFolder(sectionId: number | null) {
    if (!sectionId) return [];

    const notesInFolder = notesStore.notes.filter(note =>
      note.section_id === sectionId && !note.share_permission
    );

    const folderKey = `folder_${sectionId}`;
    const order = notesStore.noteOrder?.[folderKey];

    console.log('[useNotesFormatting] getOrderedNotesForFolder', {
      sectionId,
      folderKey,
      hasOrder: !!order,
      orderLength: order?.length,
      notesInFolderCount: notesInFolder.length,
      order: order
    });

    if (order && order.length > 0) {
      // Create a new array to ensure Vue detects the change
      const sorted = [...notesInFolder].sort((a, b) => {
        const indexA = order.indexOf(a.id);
        const indexB = order.indexOf(b.id);

        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }

        if (indexA === -1 && indexB !== -1) return 1;
        if (indexA !== -1 && indexB === -1) return -1;

        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      console.log('[useNotesFormatting] Sorted notes:', sorted.map(n => ({
        id: n.id.substring(0, 8),
        title: n.title.substring(0, 20),
        orderIndex: order.indexOf(n.id)
      })));

      return sorted;
    }

    console.log('[useNotesFormatting] No order, sorting by date');
    // Create a new array here too
    return [...notesInFolder].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  return {
    formatDate,
    formatTime,
    formatHeaderDate,
    getNoteLocation,
    getOrderedNotesForFolder
  };
}
