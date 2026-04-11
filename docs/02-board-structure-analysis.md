# Board Structure Analysis

This document describes the reference board structure that inspired this MCP. It captures the workflow patterns, naming conventions, and task management philosophy that the configuration engine uses as its default template.

## 1. Board Overview

The reference board follows a GTD-inspired personal productivity system. It acts as an operational command center for daily execution across multiple life domains: task management, calendar coordination, email processing, and workflow automation.

- Default view: kanban
- Default card type: project
- Card type: Always `project`. The `story` type exists in Planka but is never used in this workflow. The MCP hard-codes `type: "project"` on all card creation and never exposes the type parameter.

## 2. List Structure (Workflow Pipeline)

The board implements a staged workflow with 11 lists (8 active + 1 closed + 2 system). Items flow through these stages from capture to completion and archival:

| Name | Type | Purpose | Entry Criteria | WIP Limit |
|------|------|---------|----------------|-----------|
| INBOX | active | Capture point. New items land here from any source: email, calendar, web, manual entry, AI agents. Unsorted, minimal metadata. | None. Anything can enter. | None |
| BACKLOG | active | Triaged and enriched items. Sorted by due date. Long-term items not yet scheduled. | Must have: domain label, type label, priority, duration, due date. Source label optional. | None |
| NOISE | active | Low-priority or distracting items. Parked separately from BACKLOG to reduce visual noise during planning. | Due date between 24h and 72h from now. Low-priority items that shouldn't distract from focused work. | 5 |
| FOCUS | active | High-priority items needing deep attention or strategic thinking. Short-horizon work requiring concentrated effort. | Due date between 24h and 72h from now. High-priority items that need dedicated attention. | 3 |
| TODAY | active | Today's execution queue. The daily commitment. Everything here must have a clear due date within 24 hours. | Due date within the next 24 hours. Non-negotiable deadlines. | None |
| ACTIVE | active | Currently being worked on. In-flight tasks where the stopwatch is typically running. | Manually moved when work begins. | None |
| BLOCKED | active | Tasks that can't progress due to an external dependency. Blocked status is a list, not a label, because it represents a workflow state, not a metadata tag. | Task is waiting on someone or something external. | None |
| CALENDAR | active | Time-bound events synced from an external calendar. Reference items, not tasks to complete. | Calendar sync or manual entry of date-specific events. | None |
| DONE | closed | Completed items. Staging area before archival. Cards here are still visible in the board response. | Task is finished. Awaiting human command to archive. | None |
| (archive) | archive | Long-term storage for completed tasks. Cards here are excluded from the board response but remain searchable. Acts as a contextual diary for past work. | Human-triggered archival from DONE. Never deleted. | - |
| (trash) | trash | System trash list for deleted cards. | Planka system list. | - |

### Workflow Flow

The primary pipeline:

```
INBOX  -->  BACKLOG  -->  NOISE/FOCUS  -->  TODAY  -->  ACTIVE  -->  DONE  -->  ARCHIVE
                              ^                           |
                              |                           v
                           BLOCKED  <---  (waiting on dependency)
```

Key transitions:
- **INBOX to BACKLOG**: During triage, when the card gets enriched with labels, priority, duration, and due date.
- **INBOX to FOCUS**: For urgent items that skip the backlog.
- **INBOX to NOISE**: For low-signal captures that need parking.
- **BACKLOG to NOISE/FOCUS**: Automatic or manual, based on due date proximity (72h-24h window).
- **NOISE/FOCUS to TODAY**: When due date enters the 24h window.
- **TODAY to ACTIVE**: When work begins.
- **Any list to BLOCKED**: When a dependency stalls progress.
- **BLOCKED to previous list**: When the blocker is resolved.
- **ACTIVE to DONE**: When work is complete.
- **DONE to ARCHIVE**: On explicit human command. Tasks are never deleted from DONE; they're archived for future reference.

### Due Date Windows

| Window | Lists | Meaning |
|--------|-------|---------|
| > 72h from now | BACKLOG | Not yet approaching. Safe in backlog. |
| 24h - 72h | NOISE or FOCUS | Approaching. Visible in the planning horizon. NOISE for low-priority, FOCUS for high-priority. |
| < 24h | TODAY | Imminent. Must be executed today. |
| Past due | Flagged | Overdue. The forgiving system evaluates resolution options. |

## 3. Label Taxonomy

Labels encode two dimensions of classification. Status is handled by lists, not labels.

### Domain Labels (What area of life)

Domain labels are required on all BACKLOG cards and beyond. They answer "what domain does this belong to?"

| Label | Color | Purpose |
|-------|-------|---------|
| Chores | tank-green | Household and admin tasks |
| Fitness | piggy-red | Health and exercise |
| Homelab | modern-green | Home server and tech projects |
| Learning | light-orange | Educational and growth |
| Personal | lavender-fields | Personal life |
| Employer | midnight-blue | Work for primary employer |
| Work | morning-sky | General work tasks |

### Source Labels (Where it came from)

Source labels are optional. They track how the task entered the system.

| Label | Color | Purpose |
|-------|-------|---------|
| Source: Calendar | fresh-salad | Originated from a calendar event |
| Source: Email | egg-yellow | Originated from an email |

### Type Labels (What kind of attention it needs)

Type labels indicate the nature of the work or attention required.

| Label | Color | Purpose |
|-------|-------|---------|
| Type: FOCUS | summer-sky | Requires deep focus or concentrated attention |
| Type: NOISE | grey-stone | Low-signal, distracting, or low-priority work |

### Label Requirements by List

| List | Domain | Type | Source | Priority | Duration | Due Date |
|------|--------|------|--------|----------|----------|----------|
| INBOX | - | - | - | - | - | - |
| BACKLOG+ | Required | Required | Optional | Required | Required | Required |

## 4. Custom Fields ("Planning" Group)

A single custom field group called "Planning" contains three fields that support scheduling and prioritization:

| Field | Type | Show on Card | Valid Values | Purpose |
|-------|------|-------------|--------------|---------|
| Priority | number (stored as text) | Yes | 1-5 where 1 is highest | Priority ranking for sorting and filtering |
| Duration (min) | number (stored as text) | Yes | Positive integers (15, 30, 45, 60, 90, 120, 180, etc.) | Estimated effort in minutes. Used for Pomodoro planning and schedule fitting. |
| Scheduled | date (stored as text) | No | ISO 8601 datetime (e.g. "2026-04-11T14:30:00") or empty | Calendar scheduling timestamp. Empty means unscheduled. A valid ISO date means the task has been placed on the calendar. Any other value is a data consistency problem. |

All values are stored as text in Planka's custom field system. The MCP validates types on write.

## 5. Stopwatch (Time Tracking)

Cards have a native `stopwatch` field that tracks elapsed time:

```json
{
  "total": 311,
  "startedAt": null
}
```

- `total`: Accumulated seconds of tracked time.
- `startedAt`: ISO 8601 timestamp when the timer was started, or `null` when paused/stopped.

The stopwatch supports Pomodoro-style work sessions:
- **Work interval**: Configurable (default 30 minutes).
- **Rest interval**: Configurable (default 10 minutes).
- Start the stopwatch when beginning a work interval. The MCP tracks elapsed time and can notify when the interval ends.
- The MCP doesn't enforce Pomodoro. It provides the tools. The AI model or user decides when to start/stop/rest.

## 6. Archive: The Contextual Diary

Completed tasks are never deleted. They flow from DONE to the archive on explicit human command. The archive serves as a searchable history of past work -- a contextual diary.

### Why Archive Matters

When triaging a new INBOX item or working on an active task, past context is valuable:
- "Have I done something like this before?"
- "What was the outcome of that similar project last quarter?"
- "Who was involved in the infrastructure work?"

The MCP can search the archive by text, labels, or user to surface relevant past tasks. This transforms the archive from dead storage into an active knowledge base.

### Archive Behavior

- Cards in the archive are **excluded from the board response** (`GET /api/boards/:id`). They don't clutter the active view.
- Archived cards are **accessible via the archive list endpoint** with full search, label filtering, and pagination (50 cards per page, cursor-based).
- Each archived card retains a `prevListId` pointing to the list it came from (DONE). This allows unarchiving back to the original list if needed.
- The archive list is an "endless" list -- cards have no position and are ordered by `listChangedAt` (most recently archived first).
- Archive cannot be sorted (it's endless). But it can be searched and filtered.

### Archive Rules

1. **Never delete completed tasks.** Move them from DONE to archive instead.
2. **Archive is human-triggered.** The MCP can suggest archiving, but the actual move requires explicit command.
3. **Archive is searchable.** Text search, label filtering, and user filtering all work against the archive.
4. **Archive is read-heavy, write-rare.** Once archived, cards are almost never modified. They're there for reference.

## 7. List Sorting

Lists must be kept sorted to maintain visual clarity and correct prioritization. The sort operation is server-side -- it mutates card positions in the database, not just the display.

### Sort Rules by List

| List | Sort Field | Sort Order | Rationale |
|------|-----------|------------|-----------|
| INBOX | createdAt | asc (oldest first) | Oldest captures should be triaged first. FIFO processing. |
| BACKLOG | dueDate | asc (earliest first) | Items approaching their due date should be visible at the top. |
| NOISE | dueDate | asc | Same as BACKLOG. Approaching items surface for attention. |
| FOCUS | dueDate | asc | Same. Nearest deadlines at top. |
| TODAY | dueDate | asc | Most urgent items first within the day. |
| ACTIVE | dueDate | asc | If multiple items are active, the most urgent should be top. |
| BLOCKED | dueDate | asc | Blocked items with nearest deadlines need attention first. |
| CALENDAR | dueDate | asc | Chronological event order. |
| DONE | createdAt | desc (newest first) | Most recently completed items at top for easy archiving. |

### Sort API

- **Endpoint**: `POST /api/lists/:listId/sort`
- **Body**: `{"fieldName": "name|dueDate|createdAt", "order": "asc|desc"}`
- **Effect**: Mutates card positions server-side. Cards with null due dates sort to the end when sorting by dueDate.
- **Limitation**: Only works on `active` and `closed` type lists. Archive and trash lists cannot be sorted (they're "endless").

### When to Sort

The MCP should re-sort lists after operations that could disrupt ordering:
- After moving a card into a list (the card lands at a specified position, which may not match the sort order).
- After updating a card's due date.
- During daily planning as part of the daily_summary routine.

Sorting is idempotent. Calling sort on an already-sorted list is a no-op (positions don't change).

## 8. Card Naming Conventions

Several patterns appear in card names:
- **Emoji prefix**: A chain-break emoji marks cards that were auto-generated or processed by an AI agent.
- **Category prefix**: "Homelab:", "Infrastructure:", "Health:" provide domain context inline.
- **Action prefix**: "Read:", "Evaluate", "Review" indicate the task type.
- **Raw URLs**: Some INBOX items are just URLs captured quickly for later triage.

## 9. The Forgiving System

The system is designed to handle overdue tasks gracefully rather than punishing the user with a growing pile of red items.

### Principles

1. **Never extend another task's due date to accommodate a late task.** If task A is overdue and task B's due date would need to shift, that's a human decision. The system never proposes pushing task B later to "make room" for overdue task A.

2. **Propose solutions, don't auto-execute.** When a task is overdue, the system presents options:
   - Can lower-priority tasks in TODAY be moved back to FOCUS/BACKLOG to make room?
   - Can the overdue task's duration be split across multiple sessions?
   - Does the overdue task still matter, or should it be moved to NOISE/BACKLOG?

3. **Respect the priority hierarchy.** A priority-1 overdue task gets more aggressive intervention than a priority-5 overdue task. But even a priority-1 task never displaces another task's due date.

4. **Surface the conflict, don't hide it.** The daily summary always shows overdue items prominently. The AI model should raise the conflict explicitly and ask the user for a decision.

### What the system can do automatically:
- Flag overdue tasks in every response.
- Suggest moving lower-priority items from TODAY to BACKLOG if TODAY is overloaded.
- Adjust estimated duration of overdue tasks if partial progress was made.
- Notify the user about scheduling conflicts.

### What requires human decision:
- Actually moving due dates.
- Canceling or deprioritizing tasks.
- Choosing between competing priorities when both are overdue.

## 10. Workflow Insights for MCP Design

1. **Multi-source capture**: Tasks arrive from email, calendar, web, manual entry, and AI agents. INBOX must accept minimal data.
2. **Mandatory enrichment at triage**: Moving from INBOX to BACKLOG requires adding domain label, type label, priority, duration, and due date.
3. **Time-windowed promotion**: NOISE/FOCUS are populated by due-date proximity (72h-24h). This can be automated or surfaced as suggestions.
4. **WIP limits matter**: NOISE max 5, FOCUS max 3. These limits keep the planning horizon manageable.
5. **Stopwatch for execution**: ACTIVE cards should use the stopwatch with Pomodoro intervals.
6. **Status is a list, not a label**: BLOCKED is a workflow state (list), not metadata (label). This simplifies filtering and makes status changes visible on the board.
7. **Calendar scheduling**: The Scheduled custom field tracks when a task is placed on the calendar. This bridges Planka tasks with external calendar systems.
8. **Graceful degradation on overdue**: The forgiving system surfaces problems without making unilateral decisions about other tasks' timelines.
9. **Archive as contextual diary**: Completed tasks are archived, not deleted. The archive is searchable and provides context for current work.
10. **Lists stay sorted**: Each list has a defined sort order (INBOX by creation date, everything else by due date). The MCP should maintain sort order after operations that disrupt it.
