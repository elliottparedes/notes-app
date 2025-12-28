export function useSidebarResize() {
  const sidebarWidth = ref(260);
  const noteListWidth = ref(280);
  const isResizing = ref(false);
  const isResizingNoteList = ref(false);

  function handleSidebarResizeStart(e: MouseEvent) {
    e.preventDefault();
    isResizing.value = true;

    const startX = e.clientX;
    const startWidth = sidebarWidth.value;

    function handleMouseMove(e: MouseEvent) {
      const diff = e.clientX - startX;
      const newWidth = Math.max(200, Math.min(500, startWidth + diff));
      sidebarWidth.value = newWidth;
    }

    function handleMouseUp() {
      isResizing.value = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function handleNoteListResizeStart(e: MouseEvent) {
    e.preventDefault();
    isResizingNoteList.value = true;

    const startX = e.clientX;
    const startWidth = noteListWidth.value;

    function handleMouseMove(e: MouseEvent) {
      const diff = e.clientX - startX;
      const newWidth = Math.max(200, Math.min(500, startWidth + diff));
      noteListWidth.value = newWidth;
    }

    function handleMouseUp() {
      isResizingNoteList.value = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  return {
    sidebarWidth,
    noteListWidth,
    isResizing,
    isResizingNoteList,
    handleSidebarResizeStart,
    handleNoteListResizeStart
  };
}
