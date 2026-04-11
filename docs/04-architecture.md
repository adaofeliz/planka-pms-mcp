# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        AI Model                              │
│                   (Claude, GPT, etc.)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │ MCP Protocol (stdio/SSE)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     MCP Server                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Tool Router                           │  │
│  │  Resolves tool calls to handlers. Tools are generated  │  │
│  │  dynamically from configuration at startup.            │  │
│  └───────────┬───────────────────────────┬───────────────┘  │
│              │                           │                   │
│  ┌───────────▼──────────┐  ┌────────────▼────────────────┐  │
│  │   Response Shaper    │  │    Config Engine             │  │
│  │                      │  │                              │  │
│  │  Transforms raw API  │  │  Loads YAML/JSON config.     │  │
│  │  responses into      │  │  Defines board semantics,    │  │
│  │  tiered output       │  │  tool generation rules,      │  │
│  │  (T1/T2/T3).         │  │  field mappings, and         │  │
│  │                      │  │  valid transitions.          │  │
│  └───────────┬──────────┘  └────────────┬────────────────┘  │
│              │                           │                   │
│  ┌───────────▼───────────────────────────▼───────────────┐  │
│  │                  Planka Client                         │  │
│  │                                                       │  │
│  │  HTTP client with:                                    │  │
│  │  - Board skeleton cache (lists, labels, fields)       │  │
│  │  - Name-to-ID resolution                              │  │
│  │  - Auth header injection (X-Api-Key)                  │  │
│  │  - Error normalization                                │  │
│  └───────────────────────┬───────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Planka Instance                            │
│                  (REST API over HTTPS)                        │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. MCP Server (Entry Point)

Built on the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk). Handles:

- **Transport**: stdio for CLI-based usage (Claude Code, Cursor, etc.), SSE for web-based clients.
- **Tool registration**: At startup, reads configuration and registers tools dynamically.
- **Request routing**: Dispatches tool calls to the appropriate handler function.
- **Lifecycle**: Stateless per-request. Board cache lives across requests within a session.

```typescript
// Pseudocode: Server initialization
const config = loadConfig("planka-config.yaml");
const client = new PlankaClient(config.connection);
const tools = generateTools(config);

const server = new McpServer({ name: "planka-pms", version: "1.0.0" });
for (const tool of tools) {
  server.tool(tool.name, tool.description, tool.schema, tool.handler);
}
```

### 2. Config Engine

The config engine is the core differentiator. It transforms a declarative YAML configuration into a running MCP with the right tools, semantics, and response shapes.

#### Configuration Schema

```yaml
# planka-config.yaml

connection:
  base_url: "${PLANKA_BASE_URL}"
  api_key: "${PLANKA_API_KEY}"
  board_id: "${PLANKA_BOARD_ID}"

board:
  # Card type: always "project". The "story" type is never used.
  card_type: "project"

  # List semantics: maps list names to workflow roles
  lists:
    inbox: "INBOX"
    backlog: "BACKLOG"
    noise: "NOISE"           # optional, board-specific
    focus: "FOCUS"           # optional, board-specific
    today: "TODAY"           # optional, board-specific
    active: "ACTIVE"
    blocked: "BLOCKED"       # status as list, not label
    calendar: "CALENDAR"     # optional, board-specific
    done: "DONE"
    # archive and trash are auto-detected by list type, not name

  # WIP limits per list (null = unlimited)
  wip_limits:
    noise: 5
    focus: 3

  # Valid transitions define what moves are allowed
  transitions:
    inbox: [backlog, noise, focus, today, active, done]
    backlog: [noise, focus, today, active, blocked, done]
    noise: [backlog, focus, today, active, blocked, done]
    focus: [today, active, backlog, noise, blocked, done]
    today: [active, focus, backlog, blocked, done]
    active: [done, today, focus, backlog, blocked]
    blocked: [backlog, noise, focus, today, active]  # returns to previous stage
    calendar: [done, today, active]
    done: []  # terminal state

  # Default list for new cards
  default_capture_list: inbox

  # Sort rules: how each list stays ordered
  sort_rules:
    inbox: { field: createdAt, order: asc }       # oldest captures first (FIFO)
    backlog: { field: dueDate, order: asc }        # nearest due date first
    noise: { field: dueDate, order: asc }
    focus: { field: dueDate, order: asc }
    today: { field: dueDate, order: asc }
    active: { field: dueDate, order: asc }
    blocked: { field: dueDate, order: asc }
    calendar: { field: dueDate, order: asc }
    done: { field: createdAt, order: desc }        # newest completions first

  # Archive settings
  archive:
    # Cards in DONE are never deleted, only archived
    never_delete_done: true
    # Archive is searchable for past context
    search_enabled: true
    # Page size for archive queries
    page_size: 50

  # Due date windows for automatic promotion suggestions
  due_date_windows:
    # Cards with due dates in this range should be in NOISE or FOCUS
    approaching:
      min_hours: 24
      max_hours: 72
    # Cards with due dates in this range should be in TODAY
    imminent:
      max_hours: 24

labels:
  # Categorize labels by purpose for filtering/grouping
  # Note: status is managed by lists, not labels
  categories:
    domain:
      - Chores
      - Fitness
      - Homelab
      - Learning
      - Personal
      - Employer     # renamed from actual employer name
      - Work
    source:
      - "Source: Calendar"
      - "Source: Email"
    type:
      - "Type: FOCUS"
      - "Type: NOISE"

  # Which label categories are required when leaving INBOX
  required_on_triage:
    - domain
    - type

custom_fields:
  # Map custom fields to semantic roles
  priority:
    field_name: "Priority"
    type: number
    range: [1, 5]           # 1 = highest
    show_in_summary: true
    required_on_triage: true
  duration:
    field_name: "Duration (min)"
    type: number
    unit: minutes
    show_in_summary: true
    required_on_triage: true
  scheduled:
    field_name: "Scheduled"
    type: datetime            # ISO 8601 strict: "2026-04-11T14:30:00"
    show_in_summary: false
    validation: iso8601       # empty = unscheduled, valid date = scheduled, anything else = error

pomodoro:
  # Pomodoro technique settings (used with card stopwatch)
  work_interval_minutes: 30
  rest_interval_minutes: 10
  # How many work intervals before a long rest
  intervals_before_long_rest: 4
  long_rest_minutes: 30

forgiving_system:
  # How the system handles overdue tasks
  enabled: true
  rules:
    # Never propose extending another task's due date
    never_extend_other_due_dates: true
    # Suggest moving lower-priority items from TODAY when overloaded
    suggest_deprioritize_today: true
    # Suggest splitting overdue task duration across sessions
    suggest_split_duration: true
    # Surface overdue items prominently in every summary response
    always_surface_overdue: true

response:
  # Tier 1 fields (summary) - labels included for context
  tier1:
    - id
    - name
    - list
    - due_date
    - overdue
    - priority
    - duration_min
    - labels
    - has_description
    - tasks_progress
    - stopwatch_running

  # Tier 2 adds these fields
  tier2_additions:
    - description
    - members
    - task_lists_detail
    - attachments_count
    - comments_count
    - custom_fields
    - scheduled
    - stopwatch_total_seconds
    - created
    - last_moved

  # Tier 3 adds these fields
  tier3_additions:
    - comments
    - actions
    - attachments_detail

tools:
  # Which tools to generate beyond the core set
  generate:
    - name: triage_card
      description: "Move card from INBOX, set priority, duration, labels, and due date"
      composed_of: [move_card, update_card]
      defaults:
        source_list: inbox
      required_params: [target_list, domain_label, type_label, priority, duration_min, due_date]

    - name: schedule_for_today
      description: "Move a card to TODAY"
      composed_of: [move_card]
      defaults:
        target_list: today

    - name: start_working
      description: "Move a card to ACTIVE and start the stopwatch"
      composed_of: [move_card, start_stopwatch]
      defaults:
        target_list: active

    - name: park_as_noise
      description: "Park a card in NOISE"
      composed_of: [move_card]
      defaults:
        target_list: noise

    - name: block_card
      description: "Move a card to BLOCKED with a reason comment"
      composed_of: [move_card, add_comment]
      defaults:
        target_list: blocked

    - name: start_pomodoro
      description: "Start a Pomodoro work session on a card"
      composed_of: [start_stopwatch]
      defaults:
        interval: work

    - name: stop_pomodoro
      description: "Stop the current Pomodoro and show elapsed time"
      composed_of: [stop_stopwatch]

    - name: archive_card
      description: "Move a completed card from DONE to the archive"
      composed_of: [move_card]
      defaults:
        source_list: done
        target_list: archive

    - name: sort_list
      description: "Re-sort a list according to its configured sort rule"
      composed_of: [sort_list]

cache:
  # Board skeleton cache TTL
  skeleton_ttl_seconds: 300
  # Whether to preload board skeleton on startup
  preload: true
```

#### How Config Drives Tool Generation

At startup, the config engine:

1. **Parses the YAML** and validates against the schema.
2. **Resolves environment variables** (`${PLANKA_BASE_URL}` etc.).
3. **Generates core tools** (board_overview, list_cards, get_card, create_card, move_card, update_card, complete_card, search_cards, daily_summary, manage_checklist, add_comment) with parameters bound to the configured board, lists, labels, and fields.
4. **Generates workflow tools** from the `tools.generate` section, creating composed operations with pre-filled defaults.
5. **Configures the Response Shaper** with the tier definitions.
6. **Initializes the Planka Client** with connection details and cache settings.

The result: a fully configured MCP server where every tool knows about the board's lists, labels, custom fields, and valid transitions.

### 3. Planka Client

The HTTP client layer that talks to Planka's REST API. Responsibilities:

#### Board Skeleton Cache

On first access (or at startup if `cache.preload` is true), the client fetches `GET /api/boards/:id` and caches the "skeleton":

```typescript
interface BoardSkeleton {
  board: { id: string; name: string; defaultCardType: string };
  lists: Map<string, { id: string; name: string; type: string; position: number }>;
  labels: Map<string, { id: string; name: string; color: string }>;
  customFieldGroups: Array<{ id: string; name: string }>;
  customFields: Map<string, { id: string; name: string; groupId: string }>;
  members: Map<string, { id: string; name: string; role: string }>;
  lastFetched: number;
}
```

This cache serves name-to-ID resolution for all subsequent operations. It's invalidated on TTL expiry or after structural write operations.

#### Name Resolution

```typescript
// Example: resolve list name to ID
resolveListId("BACKLOG")  // case-insensitive, emoji-stripped
// → "1607295769608455181"

resolveListId("BACKLO")
// → Error: List "BACKLO" not found. Available: INBOX, BACKLOG, NOISE, FOCUS, TODAY, ACTIVE, BLOCKED, CALENDAR, DONE. Did you mean: BACKLOG?
```

The resolver uses Levenshtein distance for "did you mean?" suggestions.

#### API Method Mapping

Each Planka API operation is a typed method on the client:

```typescript
class PlankaClient {
  // Board
  getBoard(boardId: string): Promise<BoardResponse>

  // Cards
  getCardsByList(listId: string, opts?: { before?: Cursor; search?: string; userIds?: string[]; labelIds?: string[] }): Promise<CardsResponse>
  getCard(cardId: string): Promise<CardResponse>
  createCard(listId: string, data: CreateCardInput): Promise<CardResponse>
  updateCard(cardId: string, data: UpdateCardInput): Promise<CardResponse>
  deleteCard(cardId: string): Promise<void>

  // Card operations
  moveCard(cardId: string, targetListId: string, position?: number): Promise<CardResponse>
  addCardLabel(cardId: string, labelId: string): Promise<void>
  removeCardLabel(cardId: string, labelId: string): Promise<void>
  addCardMember(cardId: string, userId: string): Promise<void>
  removeCardMember(cardId: string, userId: string): Promise<void>

  // Task lists & tasks
  createTaskList(cardId: string, data: CreateTaskListInput): Promise<TaskListResponse>
  createTask(taskListId: string, data: CreateTaskInput): Promise<TaskResponse>
  updateTask(taskId: string, data: UpdateTaskInput): Promise<TaskResponse>
  deleteTask(taskId: string): Promise<void>

  // Stopwatch
  // Stopwatch - IMPORTANT: Planka stores stopwatch as-is. The client must:
  //   - On start: PATCH card with stopwatch={startedAt: new Date().toISOString(), total: existingTotal}
  //   - On stop: compute elapsed = now - startedAt, PATCH with stopwatch={startedAt: null, total: existingTotal + elapsed}
  //   - The server never computes elapsed time itself
  startStopwatch(cardId: string): Promise<CardResponse>  // sets startedAt = now, preserves total
  stopStopwatch(cardId: string): Promise<CardResponse>    // computes elapsed, adds to total, clears startedAt
  resetStopwatch(cardId: string): Promise<CardResponse>   // resets total to 0 and startedAt to null
  getStopwatch(cardId: string): Promise<{ total: number; startedAt: string | null; elapsed: number }>

  // Comments
  getComments(cardId: string): Promise<CommentsResponse>
  createComment(cardId: string, text: string): Promise<CommentResponse>

  // Actions
  getCardActions(cardId: string): Promise<ActionsResponse>

  // Custom fields
  setCustomFieldValue(cardId: string, groupId: string, fieldId: string, value: string): Promise<void>
  clearCustomFieldValue(cardId: string, groupId: string, fieldId: string): Promise<void>

  // Archive
  archiveCard(cardId: string): Promise<CardResponse>  // moves to archive list, position null
  getArchivedCards(opts?: { before?: Cursor; search?: string; labelIds?: string[]; userIds?: string[] }): Promise<CardsResponse>

  // List sorting
  sortList(listId: string, fieldName: 'name' | 'dueDate' | 'createdAt', order: 'asc' | 'desc'): Promise<ListWithCardsResponse>
}
```

### 4. Response Shaper

Transforms raw Planka API responses into tiered output. This is where token savings happen.

#### Shaping Pipeline

```
Raw API Response (20KB JSON)
    │
    ▼
Denormalize (join included entities with items)
    │
    ▼
Filter fields (keep only tier-appropriate fields)
    │
    ▼
Compute derived fields (overdue, tasks_progress, etc.)
    │
    ▼
Format (clean names, dates, compact structure)
    │
    ▼
Tiered Output (200-500 bytes)
```

#### Example: Tier 1 Shaping

Raw card from Planka (~800 bytes):
```json
{
  "id": "1610280722998757193",
  "createdAt": "2025-09-29T13:20:20.963Z",
  "updatedAt": "2026-02-12T12:23:55.887Z",
  "type": "project",
  "position": 65536,
  "name": "Infrastructure: Design Network Architecture",
  "description": "Design and document standardized network architecture...(500 chars)",
  "dueDate": "2025-12-19T18:30:00.000Z",
  "isDueCompleted": false,
  "stopwatch": {"total": 1800, "startedAt": null},
  "commentsTotal": 99,
  "isClosed": false,
  "listChangedAt": "2025-11-06T21:38:32.747Z",
  "boardId": "...",
  "listId": "...",
  "creatorUserId": "...",
  "prevListId": null,
  "coverAttachmentId": null,
  "isSubscribed": true
}
```

Tier 1 output (~150 bytes):
```json
{
  "id": "1610280722998757193",
  "name": "Infrastructure: Design Network Architecture",
  "list": "FOCUS",
  "due": "2025-12-19",
  "overdue": true,
  "priority": 1,
  "duration_min": 75,
  "labels": ["Work", "Type: FOCUS"],
  "stopwatch_running": false
}
```

That's an ~80% token reduction per card, and we haven't even excluded the `included` blob yet.

### 5. Tool Router

Routes incoming MCP tool calls to handler functions. Each handler:

1. Validates input parameters against the tool's Zod schema.
2. Resolves names to IDs using the cached board skeleton.
3. Calls the appropriate Planka Client method(s).
4. Passes the response through the Response Shaper.
5. Returns the shaped output.

For composed tools (like `triage_card`), the handler chains multiple client calls:

```typescript
// triage_card handler (pseudocode)
async function triageCard(params) {
  const cardId = params.card_id;
  const targetListId = client.resolveListId(params.target_list);

  // Move card
  await client.moveCard(cardId, targetListId);

  // Set labels if provided
  if (params.labels) {
    for (const label of params.labels) {
      const labelId = client.resolveLabelId(label);
      await client.addCardLabel(cardId, labelId);
    }
  }

  // Set priority if provided
  if (params.priority) {
    await client.setCustomFieldValue(
      cardId,
      skeleton.priorityField.groupId,
      skeleton.priorityField.fieldId,
      String(params.priority)
    );
  }

  // Set duration if provided
  if (params.duration_min) {
    await client.setCustomFieldValue(
      cardId,
      skeleton.durationField.groupId,
      skeleton.durationField.fieldId,
      String(params.duration_min)
    );
  }

  // Return updated card summary
  const card = await client.getCard(cardId);
  return shaper.shape(card, Tier.SUMMARY);
}
```

## Project Structure

```
planka-pms-mcp/
├── docs/                        # This documentation
├── src/
│   ├── index.ts                 # Entry point, MCP server setup
│   ├── config/
│   │   ├── loader.ts            # YAML config loader + env resolution
│   │   ├── schema.ts            # Zod schema for config validation
│   │   └── types.ts             # Config type definitions
│   ├── client/
│   │   ├── planka-client.ts     # HTTP client for Planka API
│   │   ├── cache.ts             # Board skeleton cache
│   │   ├── resolver.ts          # Name-to-ID resolution
│   │   └── types.ts             # API response type definitions
│   ├── tools/
│   │   ├── generator.ts         # Dynamic tool generation from config
│   │   ├── core/                # Core tool handlers
│   │   │   ├── board-overview.ts
│   │   │   ├── list-cards.ts
│   │   │   ├── get-card.ts
│   │   │   ├── create-card.ts
│   │   │   ├── move-card.ts
│   │   │   ├── update-card.ts
│   │   │   ├── complete-card.ts
│   │   │   ├── search-cards.ts
│   │   │   ├── daily-summary.ts
│   │   │   ├── manage-checklist.ts
│   │   │   ├── add-comment.ts
│   │   │   ├── stopwatch.ts        # start/stop/reset/status
│   │   │   ├── overdue-check.ts    # forgiving system suggestions
│   │   │   ├── archive-card.ts     # move DONE → archive
│   │   │   ├── search-archive.ts   # search past completed tasks
│   │   │   └── sort-list.ts        # re-sort list by configured rule
│   │   └── composed/            # Config-generated composed tools
│   │       └── (generated at runtime, not on disk)
│   ├── shaper/
│   │   ├── response-shaper.ts   # Tier-based response transformation
│   │   ├── tiers.ts             # Tier field definitions
│   │   └── formatters.ts        # Date, name, field formatting utils
│   ├── scheduling/
│   │   ├── due-date-windows.ts  # Time-window promotion logic
│   │   ├── pomodoro.ts          # Pomodoro interval tracking
│   │   ├── forgiving.ts         # Overdue resolution suggestions
│   │   └── wip-limits.ts        # WIP limit enforcement
│   └── utils/
│       ├── errors.ts            # Error types with suggestions
│       ├── levenshtein.ts       # Fuzzy name matching
│       └── logger.ts            # Structured logging
├── config/
│   └── default.yaml             # Default configuration (Command Center)
├── planka/                      # Planka source (reference only, not deployed)
├── .env                         # Connection credentials
├── package.json
├── tsconfig.json
└── README.md
```

## Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Runtime | Node.js (TypeScript) | MCP SDK is TypeScript-native |
| MCP SDK | `@modelcontextprotocol/sdk` | Official SDK |
| HTTP Client | `undici` or `node-fetch` | Lightweight, no axios overhead |
| Config | YAML + Zod validation | Human-readable config, runtime type safety |
| Schema Validation | Zod | Already required by MCP SDK for tool schemas |
| Transport | stdio (primary), SSE (optional) | stdio for CLI tools, SSE for web clients |

## Extensibility Points

### Adding a New Board Configuration

1. Copy `config/default.yaml` to `config/my-board.yaml`.
2. Update connection details and board_id.
3. Map list names to workflow roles.
4. Define label categories.
5. Map custom fields.
6. Add any workflow-specific tools to `tools.generate`.
7. Start the server with `--config config/my-board.yaml`.

### Adding a New Core Tool

1. Create handler in `src/tools/core/my-tool.ts`.
2. Export: name, description, Zod schema, handler function.
3. Register in the core tools manifest.
4. The tool is available regardless of configuration.

### Adding a New Response Tier

1. Define the field set in `src/shaper/tiers.ts`.
2. Add the tier name to the config schema.
3. Reference it in tool definitions.

### Supporting Non-Planka Backends (Future)

The architecture separates the Planka Client from the MCP tools layer. In theory, swapping `PlankaClient` for a `TrelloClient` or `LinearClient` that implements the same interface would let the same config-driven tools work against a different backend. This isn't a priority, but the separation makes it possible without rewriting the tool layer.

## Security Considerations

- **API keys are never logged or returned in tool responses.** They're loaded from environment variables and injected into request headers only.
- **The MCP server doesn't store any Planka data persistently.** The board skeleton cache is in-memory only and lost on restart.
- **No write operations are performed without explicit tool calls.** The MCP never modifies data autonomously.
- **Configuration files should not contain secrets.** Use `${ENV_VAR}` references for connection credentials.
