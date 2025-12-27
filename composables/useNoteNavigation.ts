import { nextTick } from 'vue';
import { useNotesStore } from '~/stores/notes';
import { useFoldersStore } from '~/stores/folders';
import { useSpacesStore } from '~/stores/spaces';
import type { Note } from '~/models';

export function useNoteNavigation() {
  const notesStore = useNotesStore();
  const foldersStore = useFoldersStore();
  const spacesStore = useSpacesStore();

  /**
   * Navigates to a note, expanding the space and selecting the folder if necessary.
   * This logic is based on dashboard.vue's handleSearchNoteSelected.
   */
  async function navigateToNote(note: Note | string | { id: string }, expandedSpaceIds?: Set<number>, onFolderSelected?: (folderId: number) => void) {
    let noteObj: Note | undefined;
    
    const noteId = typeof note === 'string' ? note : note.id;
    
    // Always try to find the full note in the store first
    noteObj = notesStore.notes.find(n => n.id === noteId);
    
    if (!noteObj && typeof note !== 'string' && 'folder_id' in note) {
      // If not in store but passed object seems complete
      noteObj = note as Note;
    }
      
    if (!noteObj) {
      try {
        // Try to fetch it from the API if not in store
        const fetchedNote = await notesStore.fetchNote(noteId);
        if (fetchedNote) {
          noteObj = fetchedNote;
        }
      } catch (error) {
        console.error(`Failed to fetch note with ID ${noteId}:`, error);
      }
    }

    if (!noteObj) {
      console.warn(`Could not find or fetch note:`, noteId);
      return;
    }

    try {
      console.log(`[Navigation] Navigating to note: ${noteObj.title} (${noteObj.id})`);
      
      if (noteObj.folder_id) {
        let folder = foldersStore.getFolderById(noteObj.folder_id);
        
        if (!folder) {
          console.log(`[Navigation] Folder ${noteObj.folder_id} not found, fetching folders...`);
          // Folder not found, try to fetch all folders
          await foldersStore.fetchFolders(null, true);
          folder = foldersStore.getFolderById(noteObj.folder_id);
        }

        if (folder) {
          const spaceId = folder.space_id;
          console.log(`[Navigation] Note is in folder "${folder.name}" in space ${spaceId}`);
          
          // Expand the space (notebook)
          spacesStore.expandSpace(spaceId);
          
          // Set as current space
          spacesStore.setCurrentSpace(spaceId);
          
          // Ensure folders are loaded for this space
          await foldersStore.fetchFolders(spaceId, true);
          
          // Select the folder (Always call it even if already selected to ensure UI state sync)
          if (onFolderSelected) {
            console.log(`[Navigation] Selecting folder ${folder.id}`);
            onFolderSelected(folder.id);
          }
          
          // Wait for UI to update
          await nextTick();

          // Open the note
          console.log(`[Navigation] Opening note ${noteObj.id}`);
          await notesStore.openTab(noteObj.id);
        } else {
          console.log(`[Navigation] Folder still not found, just opening note`);
          // Fallback: just open the note
          await notesStore.openTab(noteObj.id);
        }
      } else {
        console.log(`[Navigation] Note has no folder, just opening`);
        // Note has no folder, just open it
        await notesStore.openTab(noteObj.id);
      }
    } catch (error) {
      console.error('Failed to navigate to note:', error);
    }
  }

  return {
    navigateToNote
  };
}
