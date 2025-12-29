# API Documentation

This guide explains how to use the Notes App API to programmatically access and manage your notes.

## Authentication

All API requests require your API Key. You can pass the key in one of two ways:

### Option 1: Authorization Header (Recommended)
Add the `Authorization` header with the `Bearer` scheme:
```http
Authorization: Bearer na_your_api_key_here
```

### Option 2: X-API-Key Header
Add the custom `X-API-Key` header:
```http
X-API-Key: na_your_api_key_here
```

> **Note:** Replace `na_your_api_key_here` with the actual key generated from your user settings.

---

## Base URL
For local development:
```
http://localhost:3000/api
```
*(Replace with your production domain if deployed)*

---

## Endpoints

### 1. Get All Notes
Retrieves a list of all notes accessible to the user (owned and shared).

*   **Method:** `GET`
*   **URL:** `/notes`

#### cURL Example
```bash
curl -X GET http://localhost:3000/api/notes \
  -H "Authorization: Bearer na_your_api_key_here"
```

#### Postman Example
*   **Method:** GET
*   **URL:** `{{base_url}}/notes`
*   **Headers:**
    *   `Authorization`: `Bearer {{api_key}}`

---

### 2. Create a Note
Creates a new note.

*   **Method:** `POST`
*   **URL:** `/notes`
*   **Content-Type:** `application/json`

#### Request Body
| Field | Type | Description |
| :--- | :--- | :--- |
| `title` | string | (Optional) Title of the note. Defaults to "Untitled". |
| `content` | string | (Optional) HTML or text content. |
| `tags` | array | (Optional) Array of string tags. |
| `section_id` | number | (Optional) ID of the notebook section (folder) to place the note in. |

> **Note on Ordering:** When creating a note, it is not automatically added to the custom manual sort order. It will appear based on the default sort (usually by date) until you explicitly move or reorder it using the endpoints below.

#### cURL Example
```bash
curl -X POST http://localhost:3000/api/notes \
  -H "Authorization: Bearer na_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My API Note",
    "content": "<p>This note was created via API.</p>",
    "tags": ["api", "automation"]
  }'
```

#### Postman Example
*   **Method:** POST
*   **URL:** `{{base_url}}/notes`
*   **Body (raw JSON):**
    ```json
    {
      "title": "Project Ideas",
      "content": "<h1>Q4 Goals</h1><ul><li>Launch API</li></ul>",
      "tags": ["work", "planning"]
    }
    ```

---

### 3. Get a Single Note
Retrieves the details of a specific note by its ID.

*   **Method:** `GET`
*   **URL:** `/notes/:id`

#### cURL Example
```bash
curl -X GET http://localhost:3000/api/notes/your-note-uuid-here \
  -H "Authorization: Bearer na_your_api_key_here"
```

---

### 4. Update a Note
Updates an existing note.

*   **Method:** `PUT`
*   **URL:** `/notes/:id`
*   **Content-Type:** `application/json`

#### Request Body
Any combination of the fields below:

| Field | Type | Description |
| :--- | :--- | :--- |
| `title` | string | New title. |
| `content` | string | New content. |
| `tags` | array | New list of tags. |
| `is_favorite` | boolean | Set favorite status. |

#### cURL Example
```bash
curl -X PUT http://localhost:3000/api/notes/your-note-uuid-here \
  -H "Authorization: Bearer na_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "is_favorite": true
  }'
```

---

### 5. Delete a Note
Permanently removes a note.

*   **Method:** `DELETE`
*   **URL:** `/notes/:id`

#### cURL Example
```bash
curl -X DELETE http://localhost:3000/api/notes/your-note-uuid-here \
  -H "Authorization: Bearer na_your_api_key_here"
```

---

## Response Codes

*   **200 OK:** Request succeeded.
*   **201 Created:** Resource successfully created.
*   **401 Unauthorized:** Invalid or missing API key.
*   **403 Forbidden:** Valid key but insufficient permissions (e.g., trying to write with a read-only key).
*   **404 Not Found:** The resource (note) does not exist or you do not have access to it.
*   **429 Too Many Requests:** Rate limit exceeded.

---

## Folders & Organization

### 6. Get All Folders
Retrieves all folders (sections) for the user.

*   **Method:** `GET`
*   **URL:** `/folders`

#### cURL Example
```bash
curl -X GET http://localhost:3000/api/folders \
  -H "Authorization: Bearer na_your_api_key_here"
```

---

### 7. Create a Folder
Creates a new folder. Note: In this system, folders are placed within "Spaces" (Notebooks).

*   **Method:** `POST`
*   **URL:** `/folders`
*   **Content-Type:** `application/json`

#### Request Body
| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | string | **Required**. Name of the folder. |
| `notebook_id` | number | (Optional) ID of the Space/Notebook. Defaults to your first space if omitted. |
| `icon` | string | (Optional) Icon identifier for the folder. |

#### cURL Example
```bash
curl -X POST http://localhost:3000/api/folders \
  -H "Authorization: Bearer na_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Personal Projects",
    "icon": "folder-star"
  }'
```

---

### 8. Move a Note
Moves a note to a different folder.

*   **Method:** `PUT`
*   **URL:** `/notes/:id/move`
*   **Content-Type:** `application/json`

#### Request Body
| Field | Type | Description |
| :--- | :--- | :--- |
| `newFolderId` | number \| null | The ID of the folder to move the note to. Use `null` to move it to the root level. |

#### cURL Example
```bash
curl -X PUT http://localhost:3000/api/notes/your-note-uuid-here/move \
  -H "Authorization: Bearer na_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "newFolderId": 123
  }'
```

---

### 9. Get Spaces (Notebooks)
Retrieves your spaces. You'll need these IDs to organize folders.

*   **Method:** `GET`
*   **URL:** `/notebooks`

#### cURL Example
```bash
curl -X GET http://localhost:3000/api/notebooks \
  -H "Authorization: Bearer na_your_api_key_here"
```
