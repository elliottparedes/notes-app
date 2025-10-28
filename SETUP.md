# Setup Guide for Markdown Notes App

This guide will walk you through setting up the Markdown Notes application step by step.

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js 18 or higher
- MySQL 5.7+ or MySQL 8+
- npm or yarn package manager

## Step 1: Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Nuxt 3 framework
- NuxtUI for beautiful components
- Pinia for state management
- MySQL2 for database connectivity
- bcrypt for password hashing
- jsonwebtoken for JWT authentication
- marked for markdown rendering

## Step 2: Set Up MySQL Database

### Start MySQL Server

Make sure your MySQL server is running. You can verify this by running:

```bash
mysql --version
```

### Create Database

1. Log into MySQL:
```bash
mysql -u root -p
```

2. Run the following SQL commands:

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

-- Attachments table (for future file upload feature)
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

3. Verify tables were created:
```sql
SHOW TABLES;
```

You should see: `attachments`, `notes`, and `users`.

## Step 3: Configure Environment Variables

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Edit the `.env` file and replace all placeholder values with your actual credentials:
   - Set your database connection details (host, port, user, password, database name)
   - Generate a strong JWT secret (minimum 32 random characters)
   - Add your OpenRouter API key if using AI features
   - Set NODE_ENV to `development` for local development

**Important**: 
- Use strong, unique values for all secrets
- Never commit the `.env` file to version control (it's already in `.gitignore`)
- For production, use your hosting platform's environment variable management

## Step 4: Run the Application

Start the development server:

```bash
npm run dev
```

The application should now be running at `http://localhost:3000`

## Step 5: Create Your First Account

1. Open your browser and navigate to `http://localhost:3000`
2. You'll be redirected to the login page
3. Click "Sign up" to create a new account
4. Fill in your details:
   - Name (optional)
   - Email
   - Password (minimum 6 characters)
5. Click "Create Account"
6. You'll be automatically logged in and redirected to the dashboard

## Step 6: Create Your First Note

1. On the dashboard, click "New Note"
2. Enter a title for your note
3. Optionally add a folder name and tags
4. Write some markdown content
5. Click "Create Note"
6. You'll be taken to the note editor where you can view and edit your note

## Troubleshooting

### Database Connection Issues

If you see database connection errors:

1. Verify MySQL is running:
```bash
mysql -u root -p
```

2. Check your `.env` file has the correct credentials

3. Verify the database exists:
```sql
SHOW DATABASES;
```

4. Check user permissions:
```sql
SHOW GRANTS FOR 'root'@'localhost';
```

### Port Already in Use

If port 3000 is already in use, you can change it:

```bash
npm run dev -- --port 3001
```

### Module Not Found Errors

If you see "module not found" errors:

1. Delete `node_modules` and `.nuxt`:
```bash
rm -rf node_modules .nuxt
```

2. Reinstall dependencies:
```bash
npm install
```

3. Restart the dev server:
```bash
npm run dev
```

### TypeScript Errors

If you encounter TypeScript errors:

1. Run Nuxt prepare:
```bash
npm run postinstall
```

2. Restart your development server

## Building for Production

1. Build the application:
```bash
npm run build
```

2. Preview the production build:
```bash
npm run preview
```

3. For deployment, configure environment variables in your hosting platform's dashboard:
   - Set `NODE_ENV=production`
   - Configure all database credentials for your production database
   - Use a strong, unique JWT_SECRET
   - Add OPENROUTER_API_KEY if using AI features
   
   **Never** hard-code production secrets in your code or documentation.

## Features to Try

### Markdown Formatting

Try these markdown features in your notes:

```markdown
# Heading 1
## Heading 2
### Heading 3

**Bold text**
*Italic text*

- Bullet point 1
- Bullet point 2

1. Numbered item 1
2. Numbered item 2

[Link text](https://example.com)

`inline code`

\`\`\`javascript
// Code block
console.log('Hello, World!');
\`\`\`

> Blockquote

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
```

### Organization

- Use folders to group related notes
- Add tags for cross-cutting categories
- Mark important notes as favorites
- Use the search bar to find notes quickly

## Next Steps

- Explore the markdown editor with live preview
- Organize your notes with folders and tags
- Use the search and filter features
- Try the dark mode toggle (if implemented)

## Support

If you encounter any issues not covered in this guide, please:
1. Check the main README.md file
2. Review the error logs in the terminal
3. Check the browser console for client-side errors
4. Verify your database connection and schema

Happy note-taking! 📝

