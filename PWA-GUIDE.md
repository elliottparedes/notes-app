# Progressive Web App (PWA) Guide

This application has been converted to a Progressive Web App with offline support and local-first data storage.

## Features

### 📱 Installable
- Install the app on your mobile device or desktop
- Works like a native app with its own icon
- Launches in standalone mode (no browser UI)

### 🔌 Offline Support
- All notes are stored locally in IndexedDB
- Create, edit, and delete notes while offline
- Changes automatically sync when you're back online
- Visual indicators show connection status

### 🔄 Auto-Sync
- Changes sync automatically in the background
- Pending changes are queued and synced when online
- Conflict resolution ensures data integrity
- Manual sync button available when needed

### 💾 Local-First Architecture
- Notes are read from and written to local storage first
- Server acts as a backup/sync target
- Fast performance even with poor network
- Works completely offline after initial load

## Installation

### On Mobile (iOS/Android)

#### iOS (Safari):
1. Open the app in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" in the top right

#### Android (Chrome):
1. Open the app in Chrome
2. Tap the three-dot menu
3. Tap "Add to Home Screen" or "Install App"
4. Confirm by tapping "Install"

### On Desktop

#### Chrome/Edge:
1. Look for the install icon (➕) in the address bar
2. Click it and confirm installation
3. The app will open in its own window

#### Safari (macOS):
1. Click File → Add to Dock
2. The app will appear in your Dock

## How It Works

### Data Storage

The app uses **IndexedDB** for local storage, which provides:
- Large storage capacity (hundreds of MB)
- Fast read/write operations
- Structured data storage
- Browser-native support

### Sync Strategy

1. **Reading Data**:
   - First loads from local IndexedDB
   - Then syncs with server if online
   - Updates local storage with server data

2. **Writing Data**:
   - Immediately saves to local IndexedDB
   - Attempts to sync with server if online
   - Queues changes if offline
   - Auto-syncs when connection returns

3. **Conflict Resolution**:
   - Server is the source of truth
   - Local changes sync in order
   - Failed syncs retry with exponential backoff
   - Max 3 retry attempts before removal

### Network Status Indicators

- **Yellow Banner**: You're offline - changes saved locally
- **Blue Banner**: Currently syncing with server
- **Gray Banner**: Pending changes waiting to sync
- **Green Check**: All changes synced

## Technical Details

### Service Worker
- Caches app assets for offline use
- Enables fast loading
- Updates automatically in the background

### Technologies Used
- **@vite-pwa/nuxt**: PWA configuration and service worker
- **IndexedDB**: Client-side database
- **Workbox**: Service worker library
- **VueUse**: Network status detection

### Storage Structure

```typescript
// Notes Store (IndexedDB)
{
  id: number,
  title: string,
  content: string,
  tags: string[],
  folder: string,
  created_at: Date,
  updated_at: Date
}

// Sync Queue Store (IndexedDB)
{
  id: string,
  type: 'create' | 'update' | 'delete',
  noteId?: number,
  data?: NoteData,
  timestamp: number,
  retries: number
}
```

## Development

### Testing Offline Mode

1. **Chrome DevTools**:
   - Open DevTools (F12)
   - Go to Network tab
   - Click "Offline" in throttling dropdown

2. **Manual Testing**:
   - Turn off your WiFi
   - Disable network adapter
   - Use airplane mode

### Clearing Cache

If you need to reset everything:

```javascript
// In browser console
indexedDB.deleteDatabase('NotesDB');
localStorage.clear();
location.reload();
```

### Service Worker Updates

The service worker updates automatically:
- Checks for updates on page load
- Downloads new version in background
- Prompts user to refresh when ready
- Updates apply after page refresh

## Troubleshooting

### App Not Installing
- Ensure you're using HTTPS (required for PWA)
- Check browser compatibility
- Try a different browser

### Sync Not Working
- Check network connection
- Look for error messages in console
- Verify authentication token is valid
- Check sync queue for pending items

### Data Loss Prevention
- Notes are stored locally first
- Server acts as backup
- Regular sync prevents data loss
- Export important notes as markdown

## Best Practices

1. **Regular Syncs**: Connect to internet periodically to sync
2. **Monitor Storage**: Check browser storage if you have many notes
3. **Update App**: Refresh when update notification appears
4. **Backup Important Notes**: Use export feature for critical data

## Browser Support

- ✅ Chrome/Edge 67+
- ✅ Firefox 63+
- ✅ Safari 11.1+
- ✅ Samsung Internet 8.2+
- ✅ Opera 54+

## Future Enhancements

Potential improvements:
- Conflict resolution UI
- Storage usage indicator
- Export/import functionality
- Background sync API integration
- Push notifications
- Share target API

