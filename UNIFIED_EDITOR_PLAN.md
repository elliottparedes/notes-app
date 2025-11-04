# Unified Editor Implementation Plan

## Key Insights from Research

### Cursor Positioning System (MUST PRESERVE)
The perfect cursor placement during co-editing uses:
1. **Document position storage**: Store `position: from` (document position) in awareness, not just screen coordinates
2. **Synchronous conversion**: `updateCursorScreenPositions()` converts document positions to screen coordinates using `coordsAtPos()` synchronously
3. **Multiple update points**: Updates on `selectionUpdate`, `update`, view updates, and ResizeObserver
4. **Key technique**: Document position persists across edits, screen coordinates are calculated on-demand

### Architecture Decision
- **Base**: Use CollaborativeEditor as base (has all features)
- **Conditional**: Make Y.Doc, WebSocket, Collaboration extension optional
- **Props**: Add `isCollaborative` boolean prop
- **Performance**: Regular notes have zero collaboration overhead

## Implementation Steps

### 1. Props & Setup
```typescript
props: {
  modelValue: string,           // For regular notes (v-model)
  isCollaborative?: boolean,   // NEW: Enable collaboration
  noteId?: string,              // Required for collaborative
  // ... other props
}
```

### 2. Conditional Y.Doc & WebSocket
```typescript
const ydoc = props.isCollaborative && props.noteId
  ? ydocManager.getDoc(props.noteId)
  : null
```

### 3. Conditional Extensions
```typescript
const extensions = [
  ...baseExtensions,
  ...(props.isCollaborative && ydoc ? [Collaboration.configure({ document: ydoc })] : []),
  ...(props.isCollaborative ? [UserHighlight] : [])
]
```

### 4. Conditional Event Handlers
- Cursor positioning: Only if `isCollaborative`
- WebSocket setup: Only if `isCollaborative`
- Awareness: Only if `isCollaborative`

### 5. Content Sync
- Regular: `update:modelValue` (v-model)
- Collaborative: `update:content` + Y.Doc handles sync

## Files to Update
1. Create `UnifiedEditor.vue` (based on CollaborativeEditor)
2. Update `pages/dashboard.vue` to use UnifiedEditor with `isCollaborative` prop
3. Remove `TiptapEditor.vue` and `CollaborativeEditor.vue` (after migration)

## Testing Checklist
- [ ] Regular notes work (no Y.Doc overhead)
- [ ] Shared notes work (collaboration enabled)
- [ ] Cursor positioning perfect during co-editing
- [ ] Task lists work in both modes
- [ ] Content sync works correctly
- [ ] No performance degradation for regular notes
