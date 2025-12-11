# Agent Guide for Markdown Notes App

This codebase is a Nuxt 3 Progressive Web App (PWA) for managing markdown notes with collaborative features, AI integration, and file attachments.

## Project Overview

- **Framework**: Nuxt 3 (latest beta/v4), Vue 3, Nitro Server
- **Language**: TypeScript (Strict mode)
- **Styling**: TailwindCSS, Nuxt UI
- **Database**: MySQL (using `mysql2` driver)
- **Storage**: Minio (S3 compatible) for file attachments
- **State Management**: Pinia
- **Editor**: TipTap with Yjs for collaboration

## Essential Commands

- **Development**: `npm run dev` (Runs at http://localhost:3000)
- **Build**: `npm run build`
- **Preview**: `npm run preview`
- **Typecheck**: `npm run typecheck` (Vue-TSC)
- **Migrate**: `npm run migrate` (Runs SQL migrations from `migrations/`)

## Code Configuration

### Structure
- **`components/`**: Vue components. `UnifiedEditor.vue` is the core rich-text editor.
- **`pages/`**: File-based routing.
- **`server/api/`**: Nitro API endpoints. Follows `resource/[id].method.ts` pattern.
- **`stores/`**: Pinia stores for client-side state (`auth`, `notes`, `files`, `folders`).
- **`models/`**: TypeScript interfaces. **Always check these definitions.**
- **`migrations/`**: Raw SQL files for database schema updates.

### Database & Schema
- **Driver**: `mysql2` with connection pooling (`server/utils/db.ts`)
- **IDs**: 
  - `Users` use `INT` (Auto-increment).
  - `Notes`, `Folders`, `Files` use **UUID** (strings).
  - *Note*: Older documentation/README might reference `INT` for notes, but strictly follow the code/migrations (`002_convert_to_uuid.sql`).
- **Tables**: `users`, `notes`, `files` (formerly/related to attachments), `folders`, `spaces`.

### Storage (Files)
- **System**: Minio (S3 compatible).
- **Implementation**: `stores/files.ts` handles client logic, `server/api/files` handles endpoints.
- **Terminology**: Code references "Files" for the storage system, but sometimes "Attachments" for note-embedded media.

## Development Patterns

### Authentication
- Uses JWT in HTTP-only cookies.
- **Store**: `useAuthStore` manages state.
- **Middleware**: `auth.global.ts` protects routes; `server/utils/auth.ts` validates tokens API-side.

### Editor & Collaboration
- **Component**: `UnifiedEditor.vue` handles both local and collaborative editing.
- **Engine**: TipTap + Yjs + y-websocket.
- **Logic**:
  - `isCollaborative` prop toggles modes.
  - Collaborative mode: uses `y-websocket` provider, no local history (Y.Doc handles it).
  - Local mode: standard `v-model` with local history.

### API Endpoints
- Located in `server/api/`.
- Use `defineEventHandler`.
- Throw errors using `createError({ statusCode: 4xx, message: '...' })`.
- Return typed responses matching `models/ApiResponse.ts` when possible.

### PWA & Offline
- Configured in `nuxt.config.ts`.
- Disabled in development (`npm run dev`) for performance.
- To test PWA: `npm run build && npm run preview`.

## Gotchas & Critical Context

1.  **UUID Migration**: The project migrated from Integer IDs to UUIDs for Notes. Be careful when joining with `users` (which still uses Int IDs) or writing raw SQL queries. Check `migrations/002_convert_to_uuid.sql`.
2.  **Environment Variables**: The app relies heavily on runtime config.
    - `DB_*`: Database connection.
    - `MINIO_*`: File storage.
    - `JWT_SECRET`: Auth.
    - `OPENROUTER_API_KEY`: AI features.
3.  **Strict Types**: `models/` contains the source of truth for interfaces. `Note` interface uses `folder_id` (relational) but keeps `folder` (string) for legacy support.
4.  **AI Integration**: implementation in `server/api/notes/ask-ai.post.ts` and `generate.post.ts`. Uses Google Gemini via OpenRouter.

## Testing Strategy
- Currently lacks a comprehensive test suite in the standard paths(`tests/` is missing).
- Rely on `npm run typecheck` for static analysis.
- Manual verification via `npm run preview` is recommended for PWA/Service Worker behavior.

## Allowed Commands 
- DO NOT RUN any git commands that modify git 
- When a database transaction is required ask for permission before running it
