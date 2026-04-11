# Tool Catalog

## Progressive Disclosure Strategy

This MCP uses a 3-tier progressive disclosure model to minimize token consumption:

### Tier 1: Summary (Default)
- Returns minimal, scannable data: id, name, list, due date, priority, duration, and labels (domain + type + source).
- Labels are included at Tier 1 because they carry essential context about what domain a task belongs to and what kind of attention it needs.
- No descriptions, comments, or nested data are included.
- Designed for board overview and quick triage.
- Roughly 50 to 100 tokens per card.

### Tier 2: Detail (On-Demand)
- Returns full card data including description, labels, custom fields, and task list summaries.
- Triggered when the user or AI needs to understand a specific card.
- Roughly 200 to 500 tokens per card.

### Tier 3: Deep (Explicit Request)
- Returns everything: full comments, action history, and attachment details.
- Only for active collaboration or deep analysis on a specific card.
- Tokens vary based on content.

---

## Core Tools

### 1. `board_overview`
**Purpose**: Get the current state of the board, including all lists with card counts and key metrics.
**When to use**: Starting a session, getting orientation, or daily standup.
**Tier**: 1

Parameters:
- `board_id` (string, required): Board ID

Response shape (example):
```json
{
  "board": "Command Center",
  "lists": [
    {"name": "📩 INBOX", "count": 7, "type": "active"},
    {"name": "🎯 FOCUS", "count": 2, "type": "active"},
    {"name": "🔥 TODAY", "count": 0, "type": "active"},
    ...
  ],
  "total_cards": 24,
  "overdue_count": 5,
  "labels_summary": {"Work": 4, "Homelab": 5, ...}
}
```

### 2. `list_cards`
**Purpose**: List cards in a specific list with Tier 1 summary data.
**When to use**: Viewing a specific stage of the pipeline like INBOX, BACKLOG, or TODAY.
**Tier**: 1

Parameters:
- `list_name` (string, required): List name (e.g. "INBOX", "BACKLOG", "FOCUS", "TODAY", "ACTIVE", "BLOCKED"). Matched case-insensitively, emoji-stripped.
- `board_id` (string, optional): Board ID. Uses default if not provided.
- `sort_by` (string, optional): "position" (default), "due_date", "priority", "created"
- `filter_labels` (string[], optional): Filter by label names
- `filter_priority` (number, optional): Filter by priority (1-5)

Response shape: Array of Tier 1 card summaries:
```json
{
  "list": "➡️ BACKLOG",
  "cards": [
    {
      "id": "...",
      "name": "Security: Follow Up on Tool Removal",
      "due": "2026-01-07",
      "overdue": false,
      "priority": 1,
      "duration_min": 30,
      "labels": ["Work", "Type: NOISE"],
      "has_description": true,
      "tasks_progress": null
    }
  ]
}
```

### 3. `get_card`
**Purpose**: Get detailed information about a specific card.
**When to use**: Understanding a specific task, preparing to work on it, or updating it.
**Tier**: 2 (default) or 3 (with `include_comments=true`)

Parameters:
- `card_id` (string, required): Card ID
- `include_comments` (boolean, optional, default false): Include full comment thread (Tier 3)
- `include_actions` (boolean, optional, default false): Include activity history (Tier 3)

Response shape (Tier 2):
```json
{
  "id": "...",
  "name": "Infrastructure: Design Network Architecture",
  "list": "🎯 FOCUS",
  "type": "project",
  "description": "Design and document standardized network architecture...",
  "due": "2025-12-19T18:30:00.000Z",
  "overdue": true,
  "priority": 1,
  "duration_min": 75,
  "labels": ["Work", "Type: FOCUS"],
  "members": [],
  "task_lists": [
    {"name": "Deliverables", "completed": 2, "total": 5}
  ],
  "attachments_count": 0,
  "comments_count": 99,
  "custom_fields": {"Priority": "1", "Duration (min)": "75"},
  "scheduled": null,
  "stopwatch": {"total": 0, "running": false},
  "created": "2025-09-29",
  "last_moved": "2025-11-06"
}
```

### 4. `create_card`
**Purpose**: Quickly capture a new task to the INBOX or a specified list.
**When to use**: Capturing ideas, email follow-ups, or meeting action items.
**Tier**: N/A (write operation)

Parameters:
- `name` (string, required): Card title
- `list_name` (string, optional, default "INBOX"): Target list
- `board_id` (string, optional): Board ID
- `description` (string, optional): Card description (markdown)
- `due_date` (string, optional): ISO date
- `labels` (string[], optional): Label names to apply
- `priority` (number, optional): 1-5
- `duration_min` (number, optional): Estimated minutes

Card type is always `project`. The `story` type exists in Planka but is never used. The MCP hard-codes this.

Response: Created card Tier 1 summary.

### 5. `move_card`
**Purpose**: Move a card to a different list for triage, scheduling, or completion.
**When to use**: Daily triage (INBOX to BACKLOG), scheduling (BACKLOG to TODAY), or completing (to DONE).
**Tier**: N/A (write operation)

Parameters:
- `card_id` (string, required): Card ID
- `target_list` (string, required): Target list name ("BACKLOG", "FOCUS", "TODAY", "ACTIVE", "BLOCKED", "DONE", etc.)
- `position` (string, optional): "top" or "bottom" (default "top")

Response: Updated card Tier 1 summary with new list.

### 6. `update_card`
**Purpose**: Update card properties like name, description, due date, and priority.
**When to use**: Refining tasks during triage, updating status, or adding details.
**Tier**: N/A (write operation)

Parameters:
- `card_id` (string, required): Card ID
- `name` (string, optional): New title
- `description` (string, optional): New description
- `due_date` (string, optional): ISO date or null to clear
- `priority` (number, optional): 1-5 or null to clear
- `duration_min` (number, optional): Minutes or null to clear
- `labels_add` (string[], optional): Labels to add
- `labels_remove` (string[], optional): Labels to remove
- `is_due_completed` (boolean, optional): Mark due date as completed

Response: Updated card Tier 1 summary.

### 7. `complete_card`
**Purpose**: Mark a card as done, which moves it to the DONE list. Does not archive or delete.
**When to use**: Finishing a task. The card stays in DONE until the user explicitly archives it via `archive_card`.
**Tier**: N/A (write operation)

Parameters:
- `card_id` (string, required): Card ID

Response: Confirmation with card name and completion timestamp. Reminds user that the card can be archived when ready.

### 8. `search_cards`
**Purpose**: Search across all cards in the board by text, labels, and due dates.
**When to use**: Finding specific tasks, filtering by domain, or finding overdue items.
**Tier**: 1

Parameters:
- `query` (string, optional): Text search in card names
- `board_id` (string, optional): Board ID
- `labels` (string[], optional): Filter by label names
- `overdue` (boolean, optional): Only overdue cards
- `priority` (number, optional): Filter by priority
- `has_due` (boolean, optional): Only cards with due dates
- `list_names` (string[], optional): Filter by list names

Response: Array of Tier 1 card summaries matching criteria.

### 9. `daily_summary`
**Purpose**: Get a focused daily briefing: what's in TODAY, what's overdue, and what needs triage.
**When to use**: Start of day or planning session.
**Tier**: 1

Parameters:
- `board_id` (string, optional): Board ID

Response shape:
```json
{
  "date": "2026-04-11",
  "today": [...cards in TODAY list...],
  "active": [...cards in ACTIVE list...],
  "overdue": [...overdue cards across all lists...],
  "inbox_count": 7,
  "focus": [...cards in FOCUS list...],
  "blocked": [...cards in BLOCKED list...],
  "done_pending_archive": 3,
  "overdue_suggestions": [...forgiving system suggestions if any overdue...]
}
```

### 10. `manage_checklist`
**Purpose**: Create, update, or toggle checklist items on a card.
**When to use**: Breaking down work, tracking subtask progress, or toggling completion.
**Tier**: 2 (returns updated task list state)

Parameters:
- `card_id` (string, required): Card ID
- `action` (string, required): "add_list", "add_task", "toggle_task", "delete_task", "delete_list"
- `list_name` (string, conditional): For add_list
- `task_list_id` (string, conditional): For add_task, delete_list
- `task_name` (string, conditional): For add_task
- `task_id` (string, conditional): For toggle_task, delete_task

Response: Updated task list summary.

### 11. `add_comment`
**Purpose**: Add a comment to a card.
**When to use**: Adding notes, updates, or AI analysis results.
**Tier**: N/A (write operation)

Parameters:
- `card_id` (string, required): Card ID
- `text` (string, required): Comment text (markdown supported)

Response: Created comment summary.

### 12. `stopwatch`
**Purpose**: Start, stop, or check the stopwatch on a card for time tracking.
**When to use**: Beginning work on a task, ending a work session, checking elapsed time.
**Tier**: N/A (write operation) / 1 (for status check)

Parameters:
- `card_id` (string, required): Card ID
- `action` (string, required): "start", "stop", "reset", "status"

Response shape:
```json
{
  "card_id": "...",
  "card_name": "Infrastructure: Design Network Architecture",
  "stopwatch": {
    "total_seconds": 1811,
    "total_formatted": "30m 11s",
    "running": true,
    "started_at": "2026-04-11T14:00:00.000Z",
    "elapsed_since_start": "5m 11s"
  }
}
```

### 13. `pomodoro`
**Purpose**: Manage Pomodoro work/rest cycles on a card using the native stopwatch.
**When to use**: Starting a focused work session, taking a break, checking remaining time in the current interval.
**Tier**: 1

Parameters:
- `card_id` (string, required): Card ID
- `action` (string, required): "start_work", "start_rest", "status", "stop"
- `work_minutes` (number, optional): Override default work interval (default from config: 30)
- `rest_minutes` (number, optional): Override default rest interval (default from config: 10)

Response shape:
```json
{
  "card_id": "...",
  "card_name": "Evaluate Claude Code CLI",
  "pomodoro": {
    "phase": "work",
    "elapsed": "12m 30s",
    "remaining": "17m 30s",
    "interval": "30m",
    "sessions_today": 2
  }
}
```

### 14. `overdue_check`
**Purpose**: Analyze overdue tasks and propose resolution strategies without modifying any data.
**When to use**: During daily planning, when the daily_summary shows overdue items, or when asked about scheduling conflicts.
**Tier**: 1

Parameters:
- `board_id` (string, optional): Board ID

Response shape:
```json
{
  "overdue_cards": [
    {
      "id": "...",
      "name": "Design Network Architecture",
      "list": "FOCUS",
      "due": "2025-12-19",
      "days_overdue": 113,
      "priority": 1,
      "duration_min": 75
    }
  ],
  "suggestions": [
    {
      "type": "deprioritize_today",
      "description": "TODAY has 3 items. Card 'Browse Jewellery' (priority 3) could move to BACKLOG to make room.",
      "affected_card_id": "...",
      "action": "Requires human approval"
    },
    {
      "type": "split_duration",
      "description": "Overdue card 'Design Network Architecture' has 75min remaining. Split into two 40min sessions?",
      "affected_card_id": "...",
      "action": "Requires human approval"
    }
  ],
  "warnings": [
    "2 tasks are overdue by more than 7 days. Consider if they're still relevant."
  ]
}
```

### 15. `block_card`
**Purpose**: Move a card to the BLOCKED list with a reason comment explaining the blocker.
**When to use**: When a task can't progress due to an external dependency.
**Tier**: N/A (write operation)

Parameters:
- `card_id` (string, required): Card ID
- `reason` (string, required): Why the card is blocked (added as a comment)

Response: Updated card Tier 1 summary showing the card in the BLOCKED list.

### 16. `archive_card`
**Purpose**: Move a completed card from DONE to the archive for long-term storage.
**When to use**: After reviewing a completed task and confirming it's ready to be archived. Human-triggered only.
**Tier**: N/A (write operation)

Parameters:
- `card_id` (string, required): Card ID. Must be in the DONE list.

Response: Confirmation with card name and archive timestamp.

### 17. `search_archive`
**Purpose**: Search past completed tasks in the archive for context. Acts as a contextual diary.
**When to use**: When triaging a new task that might relate to past work, or when the user asks about historical context ("have I done this before?", "what happened with project X?").
**Tier**: 1

Parameters:
- `query` (string, optional): Text search across card names and descriptions. Prefix with `/` for regex.
- `labels` (string[], optional): Filter by label names (e.g. ["Homelab"] to find past homelab tasks).
- `limit` (number, optional, default 10): Max results to return.
- `board_id` (string, optional): Board ID.

Response shape:
```json
{
  "results": [
    {
      "id": "...",
      "name": "Implement Planka Local MCP",
      "archived_at": "2026-03-15",
      "originally_in": "DONE",
      "due": "2026-03-10",
      "priority": 2,
      "duration_min": 120,
      "labels": ["Homelab", "Type: FOCUS"],
      "has_description": true,
      "comments_count": 12
    }
  ],
  "total_scanned": 50,
  "has_more": true
}
```

### 18. `sort_list`
**Purpose**: Re-sort a list according to its configured sort rule (or a specified field).
**When to use**: After moving cards between lists, after updating due dates, or during daily planning to ensure lists are properly ordered.
**Tier**: 1

Parameters:
- `list_name` (string, required): List name (e.g. "BACKLOG", "TODAY").
- `field` (string, optional): Override sort field. One of "dueDate", "createdAt", "name". Defaults to the list's configured sort rule.
- `order` (string, optional): Override sort order. "asc" or "desc". Defaults to the list's configured sort rule.

Response shape:
```json
{
  "list": "BACKLOG",
  "sorted_by": "dueDate",
  "order": "asc",
  "card_count": 13,
  "first": {"name": "Security: Follow Up on Tool Removal", "due": "2026-01-07"},
  "last": {"name": "Homelab: Evaluate Clink vs Lovable", "due": "2026-02-27"}
}
```

Note: Sort only works on active and closed lists. Archive and trash cannot be sorted. Cards with null due dates sort to the end when sorting by dueDate.

---

## Dynamic Tool Generation

The tools above are the base set. The configuration engine can generate additional tools based on the board's list structure and workflow. Examples:

### Workflow-Derived Tools (auto-generated from config):
- `triage_card`: Move from INBOX to appropriate list, set domain label, type label, priority, duration, and due date. All required for leaving INBOX.
- `schedule_for_today`: Move card to TODAY list.
- `start_working`: Move card to ACTIVE and start the stopwatch.
- `park_as_noise`: Move card to NOISE (respects WIP limit of 5).
- `block_card`: Move card to BLOCKED with a reason comment.
- `start_pomodoro`: Start a Pomodoro work session on a card.
- `stop_pomodoro`: Stop the current Pomodoro and show elapsed time.
- `archive_card`: Move a completed card from DONE to the archive.
- `sort_list`: Re-sort a list by its configured sort rule.

### Config-Driven Tool Parameters:
The configuration engine defines:
- Which lists exist and what transitions are valid.
- WIP limits per list (e.g. NOISE: 5, FOCUS: 3). Tools will warn or reject moves that exceed limits.
- What custom fields are available and their types (including the Scheduled datetime field).
- What labels exist and how they're categorized (domain, source, type).
- Which labels and fields are required when triaging (moving out of INBOX).
- Pomodoro intervals (work, rest, long rest).
- Forgiving system rules (how to handle overdue tasks).
- Default values for new cards like list and type.
- Due date window thresholds for automatic promotion suggestions.
- Archive search settings (page size, search enabled).
- Card type (always "project" -- the "story" type is never used).

This means the same MCP codebase can serve different Planka boards with different workflows by changing configuration only.

---

## Token Budget Estimates

| Operation | Estimated Tokens (Input + Output) |
|-----------|----------------------------------|
| board_overview | ~200-300 |
| list_cards (10 cards) | ~400-600 |
| get_card (Tier 2) | ~300-500 |
| get_card (Tier 3, with comments) | ~1000-5000+ |
| create_card | ~150-200 |
| move_card | ~100-150 |
| daily_summary | ~500-800 |
| search_cards (10 results) | ~400-600 |
| stopwatch (status) | ~100-150 |
| pomodoro (start/status) | ~100-200 |
| overdue_check | ~300-600 |
| block_card | ~150-200 |
| archive_card | ~100-150 |
| search_archive (10 results) | ~400-600 |
| sort_list | ~100-200 |

Design target: A typical session to check status and triage 3 items should consume under 2000 tokens in tool I/O.
