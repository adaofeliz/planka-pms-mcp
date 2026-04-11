# MCP Philosophy: Token-Efficient Task Management

## Core Thesis

This MCP exists to give AI models structured, efficient access to a Planka-based task management system. Every design decision optimizes for one thing: **minimum tokens for maximum task management capability**.

An AI agent interacting with a task board doesn't need the same information a human browsing a UI does. It needs compact, filterable, actionable data -- and it needs to get deep only when the task demands it.

## Design Principles

### 1. Progressive Disclosure Over Eager Loading

Planka's `GET /api/boards/:id` returns everything: all lists, all cards, all labels, all tasks, all custom fields, all members. For a board with 50 cards, that's 20-50KB of JSON. An AI model consuming this pays ~5000-15000 tokens just to "look at the board."

This MCP never does that. Instead, it implements three disclosure tiers:

**Tier 1 - Summary** (~50-100 tokens per card)
Only identifiers, names, list placement, due dates, priority, labels, and duration. No descriptions, no comments, no nested data. This is what the model sees when it asks "what's on my board?" or "what's in the INBOX?"

Labels are included at Tier 1 because they carry essential context: domain (what area of life), type (what kind of attention), and source (where it came from). Without labels, a card summary like "Follow Up on Tool Removal" is meaningless -- knowing it's tagged "Work" + "Type: NOISE" tells the model everything about context and urgency.

**Tier 2 - Detail** (~200-500 tokens per card)
Full card content including description, custom field values, task list progress summaries, stopwatch state, and scheduled date. This is what the model sees when it asks "tell me about this card" or needs to make a triage decision.

**Tier 3 - Deep** (~1000-5000+ tokens per card)
Everything: full comment threads, action history, attachment details. Reserved for active collaboration, debugging, or deep analysis on a single card.

The default for every tool is Tier 1. Tier 2 and 3 are opt-in via explicit parameters.

### 2. Semantic Tools Over CRUD Operations

A naive MCP would mirror the API: `create_card`, `update_card`, `delete_card`, `move_card`, `add_label`, `remove_label`, etc. This forces the AI model to understand the API's mechanics and compose multi-step operations.

This MCP instead exposes workflow-semantic tools that map to what a task manager actually does:

- `daily_summary` instead of "get board, filter by list, check due dates"
- `triage_card` instead of "move card + add labels + set priority + set duration"
- `complete_card` instead of "update card listId to DONE list ID"
- `start_pomodoro` instead of "update card stopwatch with startedAt = now"

Each semantic tool can compose multiple API calls internally, saving the model from multi-turn tool chaining.

### 3. Names Over IDs (With ID Fallback)

Humans think in names: "move it to BACKLOG", "label it as Work". The API thinks in IDs. This MCP bridges the gap.

Tool parameters accept list names ("INBOX", "BACKLOG", "FOCUS") and label names ("Work", "Homelab") directly. The MCP resolves these to IDs internally. Case-insensitive matching. Emoji-stripped comparison.

If a name is ambiguous or not found, the error message includes available options -- teaching the model without burning a retry cycle.

### 4. Board State Caching

Planka boards don't change every second. The list structure, label definitions, custom field schemas, and board membership are effectively static during a session.

The MCP caches this "board skeleton" on first access and reuses it for all subsequent tool calls. Only card data (positions, content, list placement) is fetched fresh. This eliminates redundant API calls for every operation.

Cache invalidation happens on:
- Explicit refresh request
- Write operations that modify board structure (add/remove lists, labels)
- Configurable TTL (default: 5 minutes)

### 5. Configuration-Driven, Not Hard-Coded

The MCP's behavior, tool set, and response formatting are driven by a configuration file -- not code. A personal productivity board with INBOX-to-DONE pipeline is one configuration. A software team's sprint board with "To Do / In Progress / Review / Done" is another.

The configuration defines:
- Board ID and connection details
- List semantics (which list is "inbox", which is "done", what transitions are valid)
- WIP limits per list (e.g. NOISE max 5, FOCUS max 3)
- Label categories (domain, source, type)
- Custom field mappings (which fields represent priority, duration, scheduled date, etc.)
- Pomodoro settings (work interval, rest interval)
- Forgiving system rules (how to handle overdue tasks)
- Tool generation rules (which workflow tools to expose)
- Response formatting (what fields to include at each tier)

Changing configuration produces a different MCP with different tools, different defaults, and different response shapes -- same codebase.

### 6. Fail-Informative, Not Fail-Silent

When something goes wrong, the error response includes enough context for the AI model to self-correct:

```
Error: List "BACKLO" not found.
Available lists: INBOX, BACKLOG, NOISE, FOCUS, TODAY, ACTIVE, BLOCKED, CALENDAR, DONE
Did you mean: BACKLOG?
```

This prevents retry loops and wasted tokens on guessing.

### 7. Status Lives in Lists, Not Labels

A task's workflow status (inbox, backlog, active, blocked, done) is determined by which list it sits in -- not by a label. This is a deliberate design choice:

- Lists are mutually exclusive. A card can only be in one list. Status should be singular.
- Labels are additive. A card can have many labels. Metadata like domain and type can coexist.
- Moving a card between lists is the natural Kanban gesture for status change. Adding/removing labels for status is fragile and unintuitive.

The BLOCKED list exists specifically for this reason. Instead of a "Status: BLOCKED" label that could be forgotten or conflict with the card's list position, moving a card to BLOCKED makes the status visible, filterable, and impossible to miss.

### 8. The Forgiving System

The system handles overdue tasks gracefully. When a due date passes, the system doesn't punish -- it proposes solutions:

- Surface the overdue task prominently in every response.
- Suggest moving lower-priority items out of TODAY to make room.
- Offer to split the overdue task's remaining duration across sessions.
- Ask the user if the task still matters.

Critical constraint: **the system never proposes extending another task's due date to accommodate a late task.** That decision belongs to a human. The system can rearrange its own priorities and suggest changes, but it won't sacrifice other commitments to rescue an overdue item.

### 9. Archive as Contextual Diary

Completed tasks are never deleted. They flow from DONE to the archive on explicit human command. The archive is not dead storage -- it's a searchable knowledge base of past work.

When triaging a new INBOX item or diving into an active task, the MCP can search the archive for related context: similar tasks, past outcomes, involved people. This turns historical data into actionable intelligence without the user having to remember what they did six months ago.

The archive is excluded from the board response (no token cost during normal operations) but accessible on demand via dedicated search tools.

### 10. Lists Stay Sorted

A list with items in random order defeats the purpose of visual task management. The MCP maintains sort order as a background concern:

- INBOX: sorted by creation date (oldest first -- FIFO triage).
- All other lists: sorted by due date (earliest first -- most urgent on top).
- DONE: sorted by creation date (newest first -- most recently completed at top for easy archiving).

Sort operations are server-side mutations (Planka reorders the positions in the database). The MCP re-sorts after any operation that could disrupt ordering: moving cards between lists, updating due dates, or during daily planning.

### 11. Time-Aware Task Promotion

Tasks don't just sit in BACKLOG until someone manually moves them. The system is aware of due dates and can surface or suggest promotions:

- **72h-24h window**: Tasks approaching their due date should be in NOISE (low-priority) or FOCUS (high-priority), not buried in BACKLOG.
- **< 24h window**: Tasks due within 24 hours belong in TODAY.
- **Overdue**: Flagged prominently. Forgiving system kicks in.

The MCP can surface these as suggestions during daily_summary or triage operations, respecting WIP limits (NOISE max 5, FOCUS max 3).

## Token Budget Philosophy

A typical task management interaction should cost under 2000 tokens in tool I/O:

| Scenario | Estimated Tokens |
|----------|-----------------|
| Morning check-in: "What's on my plate today?" | ~500 |
| Triage 3 INBOX items (view + move + label) | ~800 |
| Deep dive into one card + add comment | ~600 |
| Create 2 quick capture cards | ~400 |
| Start a Pomodoro + check timer | ~200 |
| Full daily standup cycle | ~1500-2000 |

Compare this to a naive "dump the whole board" approach: 5000-15000 tokens just to start, before any actions.

## What This MCP Is Not

- **Not a Planka UI replacement**. It doesn't expose board settings, user management, background images, or notification preferences.
- **Not a generic Planka API wrapper**. It intentionally omits endpoints that aren't relevant to task management (webhooks, OIDC config, admin operations).
- **Not a real-time sync engine**. It doesn't use WebSockets or maintain persistent state. Each tool call is a fresh interaction with cached metadata.
- **Not opinionated about methodology**. The configuration engine adapts to GTD, Kanban, Scrum, Pomodoro, or any combination. The default config reflects one workflow, but it's not the only way.
- **Not an autonomous scheduler**. It surfaces information and suggests actions. It never moves due dates or deprioritizes tasks without explicit human approval.

## Relationship to Planka

This MCP consumes Planka's REST API but adds a semantic layer on top:

```
AI Model
    |
    v
MCP Tools (semantic, token-efficient, config-driven)
    |
    v  
Planka Client (API calls, caching, ID resolution)
    |
    v
Planka REST API (CRUD operations)
    |
    v
Planka Database (PostgreSQL)
```

The MCP never modifies Planka's data model or requires Planka-side changes. It's a pure consumer that adds intelligence at the integration layer.
