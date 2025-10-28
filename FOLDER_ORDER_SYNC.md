# Folder Order Sync Across Devices

This document explains how folder ordering now syncs across devices using the database.

## What Changed

The folder order is now stored in the database (`users.folder_order` column) instead of only in localStorage. This means your custom folder order will sync across all devices where you log in.

## How It Works

### 1. **Database Storage**
- The `users` table now has a `folder_order` column (JSON type)
- Stores your custom folder ordering as an array of folder names
- Syncs across all devices when you log in

### 2. **Automatic Syncing**
- When you reorder folders using "Move Left" or "Move Right", the change is:
  1. Saved to localStorage (for offline access)
  2. Sent to the server (for cross-device sync)
- When you load the dashboard:
  1. The app tries to load from the server first
  2. Falls back to localStorage if offline or server fails

### 3. **Offline Support**
- Works offline using localStorage as a cache
- When you come back online, changes are synced to the server
- If there's a conflict, server version takes precedence

## API Endpoints

### GET `/api/user/folder-order`
Retrieves your saved folder order.

**Response:**
```json
{
  "folder_order": ["Work", "Personal", "Ideas"]
}
```

### PUT `/api/user/folder-order`
Saves your custom folder order.

**Request Body:**
```json
{
  "folder_order": ["Work", "Personal", "Ideas"]
}
```

**Response:**
```json
{
  "folder_order": ["Work", "Personal", "Ideas"]
}
```

## Testing Cross-Device Sync

To test that folder order syncs across devices:

1. **On Device 1:**
   - Log in to your account
   - Create some folders (e.g., "Work", "Personal", "Ideas")
   - Reorder them using the three-dot menu → "Move Left" or "Move Right"
   - Note the order

2. **On Device 2:**
   - Log in to the same account
   - The folders should appear in the same order as Device 1
   - Reorder them differently

3. **Back on Device 1:**
   - Refresh the page
   - The folders should now match the order from Device 2

## Migration

The database migration has been run automatically. If you need to run it manually:

```bash
npm run migrate
```

Or manually execute the SQL:

```sql
ALTER TABLE users 
ADD COLUMN folder_order JSON NULL 
COMMENT 'Custom folder ordering for the user' 
AFTER name;
```

## Technical Details

### User Model
The `User` interface now includes:
```typescript
interface User {
  id: number;
  email: string;
  name: string | null;
  folder_order: string[] | null;  // New field
  created_at: Date;
  updated_at: Date;
}
```

### Store Actions
- `loadFolderOrder()` - Loads folder order from server (with localStorage fallback)
- `saveFolderOrder()` - Saves folder order to both localStorage and server
- `moveFolderLeft(folderName)` - Moves a folder left in the order
- `moveFolderRight(folderName)` - Moves a folder right in the order

### Folder Order Logic
1. If no custom order exists, folders are sorted alphabetically
2. Custom ordered folders appear first
3. New folders (not in the custom order) appear at the end, alphabetically sorted

## Rollback

If you need to remove this feature:

```sql
ALTER TABLE users DROP COLUMN folder_order;
```

Then revert the code changes in:
- `models/User.ts`
- `server/api/user/folder-order.get.ts` (delete)
- `server/api/user/folder-order.put.ts` (delete)
- `stores/notes.ts` (revert folder order methods)
- `server/api/auth/*.ts` (remove folder_order from queries)

