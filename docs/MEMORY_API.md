# Memory API Documentation

## Overview

The Memory API provides endpoints for querying, managing, and searching plot memories. Memories are structured plot elements (characters, locations, events, foreshadowings, etc.) automatically extracted from scripts or manually created.

## Base URL

```
/api/projects/:projectId/memories
```

## Authentication

All endpoints require authentication via JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

## Memory Types

- `CHARACTER` - Character information
- `LOCATION` - Location/setting information
- `EVENT` - Key plot events
- `PLOT_POINT` - Major plot turning points
- `FORESHADOWING` - Foreshadowing and悬念
- `RELATIONSHIP` - Character relationships
- `VISUAL_STYLE` - Visual style descriptions

## Endpoints

### 1. List Memories

**GET** `/api/projects/:projectId/memories`

List all memories for a project with optional filters.

**Query Parameters:**

- `type` (optional) - Filter by memory type (e.g., `CHARACTER`, `LOCATION`)
- `isActive` (optional) - Filter by active status (`true` or `false`)
- `episodeId` (optional) - Filter by episode ID
- `tags` (optional) - Filter by tags (comma-separated)
- `minImportance` (optional) - Minimum importance level (1-5)
- `category` (optional) - Filter by category

**Example:**

```bash
curl -X GET "http://localhost:4000/api/projects/proj123/memories?type=CHARACTER&isActive=true&minImportance=4" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "mem_abc123",
      "projectId": "proj123",
      "type": "CHARACTER",
      "category": "major_character",
      "title": "李明",
      "content": "30岁科学家，聪明机智，发现了一个惊人的秘密",
      "metadata": {
        "episodeNum": 1,
        "characters": ["李明"]
      },
      "tags": ["科学家", "主角"],
      "importance": 5,
      "isActive": true,
      "verified": false,
      "episodeId": "ep_001",
      "relatedIds": [],
      "createdAt": "2026-04-17T10:00:00Z",
      "updatedAt": "2026-04-17T10:00:00Z"
    }
  ]
}
```

---

### 2. Get Single Memory

**GET** `/api/projects/:projectId/memories/:memoryId`

Get a specific memory by ID.

**Example:**

```bash
curl -X GET "http://localhost:4000/api/projects/proj123/memories/mem_abc123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "mem_abc123",
    "projectId": "proj123",
    "type": "CHARACTER",
    "title": "李明",
    "content": "30岁科学家，聪明机智...",
    "importance": 5,
    "isActive": true,
    "verified": false,
    "tags": ["科学家", "主角"],
    "createdAt": "2026-04-17T10:00:00Z",
    "updatedAt": "2026-04-17T10:00:00Z"
  }
}
```

---

### 3. Create Memory

**POST** `/api/projects/:projectId/memories`

Manually create a new memory.

**Request Body:**

```json
{
  "type": "CHARACTER",
  "category": "major_character",
  "title": "王芳",
  "content": "28岁记者，勇敢执着，正在调查一桩神秘事件",
  "tags": ["记者", "调查员"],
  "importance": 4,
  "episodeId": "ep_002",
  "metadata": {
    "episodeNum": 2,
    "occupation": "记者"
  }
}
```

**Example:**

```bash
curl -X POST "http://localhost:4000/api/projects/proj123/memories" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "CHARACTER",
    "title": "王芳",
    "content": "28岁记者，勇敢执着",
    "tags": ["记者"],
    "importance": 4
  }'
```

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "mem_def456",
    "projectId": "proj123",
    "type": "CHARACTER",
    "title": "王芳",
    "content": "28岁记者，勇敢执着",
    "importance": 4,
    "tags": ["记者"],
    "createdAt": "2026-04-17T11:00:00Z",
    "updatedAt": "2026-04-17T11:00:00Z"
  }
}
```

---

### 4. Update Memory

**PUT** `/api/projects/:projectId/memories/:memoryId`

Update an existing memory.

**Request Body:**

```json
{
  "title": "李明（更新）",
  "content": "30岁科学家，已发现秘密并决定揭露真相",
  "importance": 5,
  "isActive": true,
  "verified": true,
  "tags": ["科学家", "主角", "揭露者"]
}
```

**Example:**

```bash
curl -X PUT "http://localhost:4000/api/projects/proj123/memories/mem_abc123" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "importance": 5,
    "verified": true
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "mem_abc123",
    "title": "李明（更新）",
    "content": "30岁科学家，已发现秘密并决定揭露真相",
    "importance": 5,
    "verified": true,
    "updatedAt": "2026-04-17T12:00:00Z"
  }
}
```

---

### 5. Delete Memory

**DELETE** `/api/projects/:projectId/memories/:memoryId`

Delete a memory.

**Example:**

```bash
curl -X DELETE "http://localhost:4000/api/projects/proj123/memories/mem_abc123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "message": "Memory deleted successfully"
}
```

---

### 6. Search Memories

**POST** `/api/projects/:projectId/memories/search`

Search memories by text query (searches title, content, and tags).

**Request Body:**

```json
{
  "query": "复仇",
  "limit": 10
}
```

**Example:**

```bash
curl -X POST "http://localhost:4000/api/projects/proj123/memories/search" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "复仇",
    "limit": 10
  }'
```

**Response:**

```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "mem_ghi789",
      "type": "FORESHADOWING",
      "title": "复仇伏笔",
      "content": "李明暗示将为父亲复仇...",
      "tags": ["复仇", "悬念"],
      "importance": 5
    }
  ]
}
```

---

### 7. Get Writing Context

**GET** `/api/projects/:projectId/memories/context?episodeNum=5`

Get structured writing context for a specific episode (used by script generation).

**Query Parameters:**

- `episodeNum` (required) - Target episode number

**Example:**

```bash
curl -X GET "http://localhost:4000/api/projects/proj123/memories/context?episodeNum=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "characters": "【已出场角色】\n- 李明：30岁科学家...\n- 王芳：28岁记者...",
    "locations": "【已出现场地】\n- 实验室：现代化实验室...",
    "recentEvents": "【已发生事件】（最近 10 个）\n- 发现秘密：李明发现了...",
    "activeForeshadowings": "【活跃伏笔】（未解决的悬念）\n- 复仇伏笔：李明暗示...",
    "relationships": "【角色关系】\n- 李明与王芳：合作关系...",
    "fullContext": "【已出场角色】\n...\n\n请基于以上剧情记忆，创作第 5 集的剧本..."
  }
}
```

---

### 8. Extract Memories from Episode

**POST** `/api/projects/:projectId/memories/extract`

Manually trigger memory extraction from an episode's script.

**Request Body:**

```json
{
  "episodeId": "ep_003",
  "episodeNum": 3
}
```

**Example:**

```bash
curl -X POST "http://localhost:4000/api/projects/proj123/memories/extract" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "episodeId": "ep_003",
    "episodeNum": 3
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "extracted": 8,
    "saved": 8,
    "cost": {
      "costCNY": 0.02
    }
  },
  "message": "Extracted 8 memories, saved 8"
}
```

---

### 9. Get Memory Statistics

**GET** `/api/projects/:projectId/memories/stats`

Get statistics about memories for a project.

**Example:**

```bash
curl -X GET "http://localhost:4000/api/projects/proj123/memories/stats" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "total": 45,
    "byType": {
      "CHARACTER": 12,
      "LOCATION": 8,
      "EVENT": 15,
      "FORESHADOWING": 5,
      "RELATIONSHIP": 3,
      "VISUAL_STYLE": 2
    },
    "byImportance": {
      "5": 10,
      "4": 15,
      "3": 12,
      "2": 5,
      "1": 3
    },
    "active": 38,
    "verified": 20,
    "averageImportance": 3.6
  }
}
```

---

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "error": "Missing required fields: type, title, content"
}
```

### 403 Forbidden

```json
{
  "error": "Permission denied"
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": "Memory not found"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Memory extraction failed",
  "message": "Detailed error message"
}
```

---

## Usage Examples

### Example 1: Get all active foreshadowings

```bash
curl -X GET "http://localhost:4000/api/projects/proj123/memories?type=FORESHADOWING&isActive=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Example 2: Search for character-related memories

```bash
curl -X POST "http://localhost:4000/api/projects/proj123/memories/search" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "科学家",
    "limit": 5
  }'
```

### Example 3: Update memory importance and verify it

```bash
curl -X PUT "http://localhost:4000/api/projects/proj123/memories/mem_abc123" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "importance": 5,
    "verified": true
  }'
```

### Example 4: Get context for writing episode 10

```bash
curl -X GET "http://localhost:4000/api/projects/proj123/memories/context?episodeNum=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Notes

1. **Automatic Extraction**: Memories are automatically extracted during script generation (first episode, batch episodes, and script expansion).

2. **Non-blocking**: Memory extraction errors do not prevent script generation from completing.

3. **Importance Scale**: 1-5, where 5 is most critical to the plot.

4. **Active Status**: `isActive: true` means the memory still influences future episodes.

5. **Verified Status**: `verified: true` means a user has reviewed and confirmed the memory.

6. **Tags**: Use tags for flexible categorification and searching (e.g., `["复仇", "悬念", "关键转折"]`).

---

## Integration with Script Generation

The memory system is automatically integrated into:

1. **First Episode Generation**: Memories extracted after generating episode 1
2. **Batch Episode Generation**: Memory context used for episodes 2+, memories extracted after each episode
3. **Script Expansion**: Memories extracted after manual script expansion

No manual API calls are required for automatic memory management. Use the API for:

- Manual memory creation/editing
- Custom queries and searches
- Statistics and analytics
- Triggering re-extraction
