# Planka API Reference

## 1. Authentication

Planka supports two primary authentication methods.

### API Key
Use the `X-Api-Key: <key>` header. Admins generate these keys for users via `POST /api/users/:id/api-key`. Only a hash of the key is stored. Users can identify keys in the UI by their prefix.

### JWT Bearer Token
Obtain a token by calling `POST /api/access-tokens` with a JSON body containing `emailOrUsername` and `password`. This request returns a JWT. Include this token in the `Authorization: Bearer <token>` header for subsequent requests.

### OIDC Flow
OpenID Connect is supported via `POST /api/access-tokens/exchange-with-oidc`.

## 2. Response Patterns

The API follows a consistent response structure.

### Standard Format
- **Single item**: `{item: {...}, included: {...}}`
- **Multiple items**: `{items: [...], included: {...}}`

Related entities like users, labels, task lists, and tasks appear in the `included` object. This design minimizes the need for multiple follow-up requests.

### Error Codes
- **400**: ValidationError
- **401**: Unauthorized
- **403**: Forbidden
- **404**: NotFound
- **409**: Conflict
- **422**: UnprocessableEntity

## 3. Complete Route Map

### Projects

| Method | Path | Description | Notable Params |
| :--- | :--- | :--- | :--- |
| GET | /api/projects | List accessible projects. | Returns items + included{projectManagers, baseCustomFieldGroups, boards} |
| POST | /api/projects | Create a new project. | |
| GET | /api/projects/:id | Get a project with its boards. | |
| PATCH | /api/projects/:id | Update project details. | |
| DELETE | /api/projects/:id | Delete a project. | |
| POST | /api/projects/:projectId/project-managers | Add a project manager. | |
| DELETE | /api/project-managers/:id | Remove a project manager. | |

### Boards

| Method | Path | Description | Notable Params |
| :--- | :--- | :--- | :--- |
| POST | /api/projects/:projectId/boards | Create a board. | |
| GET | /api/boards/:id | Get a board. | Returns item + included{boardMemberships, labels, lists, cards, cardMemberships, cardLabels, taskLists, tasks, customFieldGroups, customFields, customFieldValues, users, projects, attachments}. This endpoint provides the full board state. |
| PATCH | /api/boards/:id | Update board details. | |
| DELETE | /api/boards/:id | Delete a board. | |
| POST | /api/boards/:boardId/board-memberships | Add a member to the board. | |
| PATCH | /api/board-memberships/:id | Update a membership role. | |
| DELETE | /api/board-memberships/:id | Remove a member from the board. | |

### Lists

| Method | Path | Description | Notable Params |
| :--- | :--- | :--- | :--- |
| POST | /api/boards/:boardId/lists | Create a list. | |
| GET | /api/lists/:id | Get list details. | |
| PATCH | /api/lists/:id | Update a list. | name, position, color, type |
| POST | /api/lists/:id/sort | Sort cards within a list. | |
| POST | /api/lists/:id/move-cards | Move all cards to another list. | |
| POST | /api/lists/:id/clear | Archive all cards in a list. | |
| DELETE | /api/lists/:id | Delete a list. | |

### Cards

| Method | Path | Description | Notable Params |
| :--- | :--- | :--- | :--- |
| GET | /api/lists/:listId/cards | List cards with pagination and filtering. | before[listChangedAt]+before[id] cursor, search (max 128 chars), userIds (comma-sep), labelIds (comma-sep) |
| POST | /api/lists/:listId/cards | Create a card. | Required: type (project, story), name. Optional: position, description, dueDate, isDueCompleted, stopwatch |
| GET | /api/cards/:id | Get a card with all related data. | Includes taskLists, tasks, comments, labels, attachments, customFields |
| PATCH | /api/cards/:id | Update a card. | boardId, listId, type, position, name, description, dueDate, isDueCompleted, stopwatch, coverAttachmentId, isSubscribed |
| POST | /api/cards/:id/duplicate | Duplicate a card. | |
| POST | /api/cards/:id/read-notifications | Mark card notifications as read. | |
| DELETE | /api/cards/:id | Delete a card. | |
| POST | /api/cards/:cardId/card-memberships | Add a member to a card. | |
| DELETE | /api/cards/:cardId/card-memberships/userId::{userId} | Remove a member from a card. | |
| POST | /api/cards/:cardId/card-labels | Add a label to a card. | |
| DELETE | /api/cards/:cardId/card-labels/labelId::{labelId} | Remove a label from a card. | |

### Labels

| Method | Path | Description | Notable Params |
| :--- | :--- | :--- | :--- |
| POST | /api/boards/:boardId/labels | Create a label. | name, color, position |
| PATCH | /api/labels/:id | Update a label. | |
| DELETE | /api/labels/:id | Delete a label. | |

### Task Lists (Checklists)

| Method | Path | Description | Notable Params |
| :--- | :--- | :--- | :--- |
| POST | /api/cards/:cardId/task-lists | Create a task list. | Required: position, name. Optional: showOnFrontOfCard, hideCompletedTasks |
| GET | /api/task-lists/:id | Get task list details. | |
| PATCH | /api/task-lists/:id | Update a task list. | |
| DELETE | /api/task-lists/:id | Delete a task list. | |

### Tasks (Checklist Items)

| Method | Path | Description | Notable Params |
| :--- | :--- | :--- | :--- |
| POST | /api/task-lists/:taskListId/tasks | Create a task. | Required: position. Either linkedCardId or name required. Optional: isCompleted |
| PATCH | /api/tasks/:id | Update a task. | taskListId, assigneeUserId, position, name, isCompleted. Linked card tasks can only change taskListId and position. |
| DELETE | /api/tasks/:id | Delete a task. | |

### Comments

| Method | Path | Description | Notable Params |
| :--- | :--- | :--- | :--- |
| GET | /api/cards/:cardId/comments | List comments for a card. | |
| POST | /api/cards/:cardId/comments | Create a comment. | text (max 1MB) |
| PATCH | /api/comments/:id | Update a comment. | |
| DELETE | /api/comments/:id | Delete a comment. | |

### Attachments

| Method | Path | Description | Notable Params |
| :--- | :--- | :--- | :--- |
| POST | /api/cards/:cardId/attachments | Upload a file or add a link. | |
| PATCH | /api/attachments/:id | Update an attachment. | |
| DELETE | /api/attachments/:id | Delete an attachment. | |

### Custom Fields

| Method | Path | Description | Notable Params |
| :--- | :--- | :--- | :--- |
| POST | /api/boards/:boardId/custom-field-groups | Create a group at the board level. | |
| POST | /api/cards/:cardId/custom-field-groups | Create a group at the card level. | |
| GET | /api/custom-field-groups/:id | Get group details. | |
| PATCH | /api/custom-field-groups/:id | Update a group. | |
| DELETE | /api/custom-field-groups/:id | Delete a group. | |
| POST | /api/base-custom-field-groups/:id/custom-fields | Create a field in a base group. | |
| POST | /api/custom-field-groups/:id/custom-fields | Create a field in a group. | |
| PATCH | /api/custom-fields/:id | Update a field. | |
| DELETE | /api/custom-fields/:id | Delete a field. | |
| PATCH | /api/cards/:cardId/custom-field-values/customFieldGroupId:{gid}:customFieldId:{fid} | Set a field value. | Note: single colons in URL path, not double colons. |
| DELETE | /api/cards/:cardId/custom-field-values/customFieldGroupId:{gid}:customFieldId:{fid} | Clear a field value. | Note: single colons in URL path, not double colons. |

### Actions (Activity Log)

| Method | Path | Description | Notable Params |
| :--- | :--- | :--- | :--- |
| GET | /api/boards/:boardId/actions | View board activity history. | |
| GET | /api/cards/:cardId/actions | View card activity history. | Action types: createCard, moveCard, addMemberToCard, removeMemberFromCard, completeTask, uncompleteTask |

### Notifications

| Method | Path | Description | Notable Params |
| :--- | :--- | :--- | :--- |
| GET | /api/notifications | List unread notifications. | |
| GET | /api/notifications/:id | Get notification details. | |
| PATCH | /api/notifications/:id | Mark a notification as read. | |
| POST | /api/notifications/read-all | Mark all notifications as read. | |

## 4. Data Model Summary

The following hierarchy represents the core entity relationships.

```
Project → Board → List → Card → {TaskList → Task, Comment, Attachment, CardLabel, CardMembership, CustomFieldValue, Action}
```

### Key Entities and Fields

- **Project**: name, description, isPublic
- **Board**: name, description, isPublic
- **List**: name, position, color, type
- **Card**: name, description, position, type, dueDate, isDueCompleted, stopwatch (`{total: number (seconds), startedAt: string|null (ISO 8601)}`)
- **TaskList**: name, position
- **Task**: name, position, isCompleted
- **Comment**: text
- **Attachment**: name, url, type
- **Label**: name, color, position
- **CustomField**: name, type, options

## 5. Key Observations for MCP Design

- **Full State Endpoint**: `GET /api/boards/:id` returns the entire board state in a single call. This includes lists, cards, labels, members, tasks, and custom fields.
- **Active + Closed Cards**: The board response includes cards from both `active` and `closed` type lists. Only `archive` and `trash` system lists are excluded.
- **Cursor Pagination**: The API uses `before[listChangedAt]` and `before[id]` for pagination instead of offsets.
- **Atomic Operations**: No bulk or batch endpoints exist. Each change requires an individual request.
- **Text Storage**: Custom field values are stored as text in the `content` field.
- **Limited Search**: Search functionality is restricted to individual lists. No global search across boards exists.
- **Stopwatch is Client-Computed**: The `stopwatch` field stores `{total, startedAt}` as-is. The server does not compute elapsed time. The client must calculate elapsed seconds from `startedAt` and update `total` when stopping.
- **Position Auto-Adjustment**: When creating or moving a card, the API may adjust the `position` value to avoid collisions with existing cards in the target list.
- **Custom Field URL Format**: The custom field value endpoints use single colons as separators: `/custom-field-values/customFieldGroupId:{gid}:customFieldId:{fid}`. The Sails.js route config uses `::` for param binding and `[:]` for literal colons, but the actual HTTP URL uses single colons.
- **Delete Returns Item**: DELETE operations return the deleted item in the response body, which is useful for confirmation.
- **Card Moving Sets isClosed**: Moving a card to a `closed` type list automatically sets `isClosed: true` on the card. Moving back to an `active` list sets `isClosed: false`.
- **Card-Level Custom Fields Are Incomplete**: `GET /api/cards/:id` returns custom field values with IDs but does not include board-level custom field group or field definitions in `included`. The MCP must cache field name mappings from the board-level response.
- **Archive Is an Endless List**: Cards in archive/trash lists have `position: null` and are ordered by `listChangedAt`. They're fetched via `GET /api/lists/:archiveListId/cards` with cursor pagination (50 per page), search, label, and user filtering. Archive cards track their origin via `prevListId`.
- **Sort Mutates Positions**: `POST /api/lists/:id/sort` physically reassigns card positions in the database. It supports `fieldName` (name, dueDate, createdAt) and `order` (asc, desc). Only works on `active`/`closed` lists. Cards with null due dates sort to the end.
- **Card Type**: Cards have a `type` field (project or story). The board setting `defaultCardType` controls the default but doesn't enforce it. The MCP always uses `project`.
