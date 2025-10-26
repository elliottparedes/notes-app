# Markdown Notes App

A full-stack Nuxt 3 application for creating, viewing, and managing markdown notes with user authentication.

## Features

- 🔐 User authentication (signup, login, logout)
- 📝 Create, read, update, and delete markdown notes
- 🎨 Beautiful UI with NuxtUI components
- 🏷️ Tag and organize notes with folders
- ⭐ Mark notes as favorites
- 🔍 Search and filter notes
- 📱 Responsive design
- 🌙 Dark mode support
- 🔒 Type-safe with strict TypeScript
- 💾 MySQL database with connection pooling
- 🎭 State management with Pinia

## Tech Stack

- **Frontend**: Nuxt 3, Vue 3, TypeScript, NuxtUI
- **Backend**: Nuxt 3 Server API, Node.js
- **Database**: MySQL
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt
- **Markdown Rendering**: marked
- **State Management**: Pinia

## Prerequisites

- Node.js 18+ 
- MySQL 5.7+ or MySQL 8+
- npm or yarn

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
  content TEXT,
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

3. Create a `.env` file in the root directory (use `.env.example` as template):
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=markdown_notes

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_change_this_in_production

# Application Configuration
NODE_ENV=development
```

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
3. **Auto-login**: Stay logged in with JWT tokens stored in localStorage

### Notes Management

1. **Create Notes**: Click "New Note" to create a markdown note
2. **Edit Notes**: Click "Edit" on any note to modify it
3. **Delete Notes**: Click "Delete" to remove a note (with confirmation)
4. **Favorite Notes**: Star important notes for quick access
5. **Organize**: Group notes into folders
6. **Tag Notes**: Add tags for better organization
7. **Search**: Use the search bar to find notes by title or content
8. **Filter**: Filter by folder or favorites

### Markdown Support

The note editor supports full markdown syntax including:
- Headers (h1-h6)
- **Bold** and *italic* text
- Lists (ordered and unordered)
- Links and images
- Code blocks and inline code
- Blockquotes
- Tables
- And more!

## Security Features

- Password hashing with bcrypt
- JWT-based authentication
- Protected API routes
- SQL injection prevention with parameterized queries
- XSS protection with Vue's built-in escaping
- Secure session management

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | MySQL host | localhost |
| `DB_PORT` | MySQL port | 3306 |
| `DB_USER` | MySQL username | root |
| `DB_PASSWORD` | MySQL password | - |
| `DB_NAME` | Database name | markdown_notes |
| `JWT_SECRET` | JWT secret key | - |
| `NODE_ENV` | Environment | development |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Support

For support, please open an issue in the repository.
