# Markdown Notes App

A modern Progressive Web App (PWA) for creating, viewing, and managing markdown notes with user authentication.

## Features

- 🔐 **User authentication** - Secure signup, login, and JWT-based sessions
- 📝 **Rich text editing** - TipTap editor with markdown support
- 🤖 **AI-powered notes** - Generate notes with Google Gemini 2.5 Flash
- 📱 **PWA Support** - Installable app with offline capabilities
- 🔄 **Automatic sync** - Changes sync when you're back online
- 🎨 **Beautiful UI** - Modern design with NuxtUI components
- 🏷️ **Organization** - Folders and tags for easy note management
- 🔍 **Search** - Fast search across all your notes
- 🌙 **Dark mode** - Automatic dark mode support
- 📱 **Responsive** - Works perfectly on mobile, tablet, and desktop
- 🔒 **Type-safe** - Built with strict TypeScript
- 💾 **MySQL database** - Reliable data storage with connection pooling
- 🎭 **State management** - Pinia stores for reactive state

## Tech Stack

- **Frontend**: Nuxt 3, Vue 3, TypeScript, NuxtUI, TailwindCSS
- **Editor**: TipTap (extensible rich text editor)
- **Backend**: Nuxt 3 Server API, Nitro
- **Database**: MySQL with connection pooling
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt
- **State Management**: Pinia
- **Offline Storage**: IndexedDB via Dexie.js
- **PWA**: Vite PWA Plugin with Workbox
- **AI**: OpenRouter API with Google Gemini 2.5 Flash

## Prerequisites

- Node.js 20+ (required for Vite and Workbox)
- MySQL 5.7+ or MySQL 8+
- npm or yarn
- OpenRouter API key (optional, for AI features)

## Database Setup

### Create Database and Tables

Run the following SQL commands to set up your database:

```sql
CREATE DATABASE markdown_notes;

USE markdown_notes;

-- Users table
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Notes table
CREATE TABLE notes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content MEDIUMTEXT,
  tags JSON,
  is_favorite BOOLEAN DEFAULT FALSE,
  folder VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FULLTEXT INDEX idx_search (title, content)
);

-- Attachments table (for Minio files)
CREATE TABLE attachments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  note_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT,
  mime_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd markdown-notes-app
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:

Copy the `.env.example` file and fill in your actual values:

```bash
cp .env.example .env
```

Then edit `.env` with your database credentials and secrets. See `.env.example` for all required variables.

**Important:** Never commit your `.env` file to version control. It's already in `.gitignore`.

4. Make sure your MySQL server is running and the database is created.

## Development

Start the development server on `http://localhost:3000`:

```bash
npm run dev
```

## Building for Production

Build the application for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project Structure

```
markdown-notes-app/
├── app/                      # App entry point
│   └── app.vue              # Main app component
├── models/                   # TypeScript models and types
│   ├── User.ts              # User-related types
│   ├── Note.ts              # Note-related types
│   ├── Attachment.ts        # Attachment types
│   ├── ApiResponse.ts       # API response types
│   └── index.ts             # Barrel export
├── stores/                   # Pinia stores
│   ├── auth.ts              # Authentication store
│   └── notes.ts             # Notes store
├── pages/                    # Vue pages (file-based routing)
│   ├── index.vue            # Landing page
│   ├── login.vue            # Login page
│   ├── signup.vue           # Signup page
│   ├── dashboard.vue        # Notes dashboard
│   └── notes/
│       └── [id].vue         # Note editor/viewer
├── middleware/               # Route middleware
│   ├── auth.ts              # Auth guard middleware
│   └── guest.ts             # Guest middleware
├── server/                   # Server-side code
│   ├── api/                 # API endpoints
│   │   ├── auth/           # Auth endpoints
│   │   │   ├── signup.post.ts
│   │   │   ├── login.post.ts
│   │   │   └── me.get.ts
│   │   └── notes/          # Notes endpoints
│   │       ├── index.get.ts
│   │       ├── index.post.ts
│   │       ├── [id].get.ts
│   │       ├── [id].put.ts
│   │       └── [id].delete.ts
│   └── utils/               # Server utilities
│       ├── db.ts           # Database connection
│       ├── auth.ts         # Auth utilities
│       └── jwt.ts          # JWT utilities
├── plugins/                  # Nuxt plugins
│   └── init.client.ts       # Client initialization
├── nuxt.config.ts           # Nuxt configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Project dependencies
```

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)

### Notes

- `GET /api/notes` - Get all notes for current user (requires auth)
- `POST /api/notes` - Create a new note (requires auth)
- `GET /api/notes/:id` - Get a specific note (requires auth)
- `PUT /api/notes/:id` - Update a note (requires auth)
- `DELETE /api/notes/:id` - Delete a note (requires auth)

## Features Guide

### Authentication

1. **Sign Up**: Create a new account with email and password
2. **Login**: Access your account with credentials
3. **Auto-login**: Stay logged in with JWT tokens
4. **Secure Sessions**: Automatic token refresh and validation

### Notes Management

1. **Create Notes**: Multiple options
   - New Note (blank)
   - Quick Note (with timestamp)
   - AI Generate (create with AI assistance)
2. **Rich Text Editor**: TipTap editor with markdown support
3. **Folders**: Organize notes into custom folders
4. **Search & Filter**: Find notes quickly by title or content
5. **Offline Support**: Create and edit notes without internet
6. **Auto-sync**: Changes automatically sync when back online

### AI Features

1. **AI Note Generation**: Describe what you want, and AI creates a formatted note
2. **Powered by Google Gemini 2.5 Flash**: Fast and intelligent responses
3. **Keyboard Shortcuts**: Press `Cmd/Ctrl + Enter` to generate

### Offline Mode

The app works completely offline:
- View all your notes
- Create new notes
- Edit existing notes
- Changes saved locally in IndexedDB
- Automatic sync when internet returns
- Sync status indicator shows pending changes

## Security Features

- Password hashing with bcrypt
- JWT-based authentication
- Protected API routes
- SQL injection prevention with parameterized queries
- XSS protection with Vue's built-in escaping
- Secure session management

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` | MySQL host | (your database host) |
| `DB_PORT` | MySQL port | (your database port) |
| `DB_USER` | MySQL username | (your database user) |
| `DB_PASSWORD` | MySQL password | (your secure password) |
| `DB_NAME` | Database name | (your database name) |
| `JWT_SECRET` | JWT secret key | (minimum 32 random characters) |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI features | (your API key) |
| `NODE_ENV` | Environment | development or production |

**Note:** Copy `.env.example` to `.env` and fill in your actual values. Never commit `.env` to version control.

## Deployment

### Netlify Deployment

This app is optimized for Netlify deployment:

1. **Environment Variables**: Set all required environment variables in Netlify dashboard
   - Go to: Site configuration → Environment variables
   - Add: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `OPENROUTER_API_KEY`

2. **Build Settings**: Configured in `netlify.toml`
   - Node version: 20
   - Build command: `npm run build`
   - Publish directory: `.output/public`

3. **PWA Support**: Service worker is automatically generated for production

See `NETLIFY_DEPLOYMENT.md` for detailed deployment instructions.

### Other Platforms

The app can be deployed to any Node.js hosting platform:
- **Vercel**: Works out of the box
- **Railway**: Set environment variables and deploy
- **DigitalOcean App Platform**: Configure via UI
- **Docker**: Dockerfile included

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Support

For support, please open an issue in the repository.
