# AGENTS.md

## Project Overview

A GTD-inspired personal productivity system that gives AI agents the ability to manage a full task lifecycle — from inbox capture through triage, scheduling, focused execution with Pomodoro time-tracking, to completion and archival. Built on [Planka](https://planka.app) as the backing Kanban board, exposed via the Model Context Protocol (MCP).

This is not a generic Planka API wrapper. It's a **semantic productivity layer** that encodes workflow rules (valid transitions, WIP limits, due-date-windowed promotion), progressive disclosure (tiered responses that cut ~80% of token waste), and a forgiving system that surfaces overdue tasks with resolution strategies instead of punishing the user. The board structure (INBOX → BACKLOG → NOISE/FOCUS → TODAY → ACTIVE → DONE → Archive) is config-driven, and the MCP generates workflow-level tools (`triage_card`, `start_working`, `daily_summary`) instead of raw CRUD operations.

- **Language**: TypeScript (strict mode, ES2022, NodeNext)
- **Runtime**: Node.js >= 18
- **Build**: tsup (ESM, single entry point)
- **SDK**: `@modelcontextprotocol/sdk` (official MCP TypeScript SDK)
- **Validation**: Zod for all tool input schemas

## Architecture

**Primary reference**: [`docs/04-architecture.md`](docs/04-architecture.md) — this is the authoritative design document. Read it first.

The server follows a layered architecture:

```
AI Model → MCP Server (tool router) → Response Shaper → Planka Client → Planka REST API
                                         ↑
                                    Config Engine (YAML-driven tool generation)
```

Key design decisions:
- **Config-driven tool generation**: YAML config defines board semantics, valid transitions, WIP limits, and generates workflow tools at startup.
- **Progressive disclosure (T1/T2/T3)**: Tiered response shaping minimizes token consumption (~80% reduction vs raw API).
- **Semantic tools over CRUD**: Workflow-level operations (`triage_card`, `start_working`) instead of raw API wrappers.
- **Names over IDs**: Tools accept human-readable names; the server resolves to IDs internally with fuzzy matching.
- **Forgiving system**: Overdue tasks trigger resolution suggestions (deprioritize, split duration, reassess) — never silently extends other tasks' due dates.

## Documentation Map

Read these docs in order for full context:

| Doc | Purpose | When to read |
|-----|---------|--------------|
| [`docs/04-architecture.md`](docs/04-architecture.md) | **Primary design document**. System overview, component details, planned project structure, config schema, extensibility points, security model. | Always read first. This is the blueprint for all implementation work. |
| [`docs/03-mcp-philosophy.md`](docs/03-mcp-philosophy.md) | Design principles: progressive disclosure, token budget philosophy, semantic tools, fail-informative errors, forgiving system, archive-as-diary. | Before making any design decisions or adding new tools. |
| [`docs/05-tool-catalog.md`](docs/05-tool-catalog.md) | Complete tool specifications: parameters, response shapes, token budget estimates, dynamic tool generation rules. | When implementing or modifying any tool. |
| [`docs/02-board-structure-analysis.md`](docs/02-board-structure-analysis.md) | Reference board structure: list pipeline (INBOX→DONE→Archive), label taxonomy, custom fields, due date windows, stopwatch/pomodoro, forgiving system rules, sort rules. | When working on board-specific logic, transitions, or scheduling features. |
| [`docs/01-planka-api-reference.md`](docs/01-planka-api-reference.md) | Planka REST API: authentication, response patterns, complete route map, data model, key observations (cursor pagination, stopwatch client-side computation, custom field URL format). | When implementing or debugging Planka client HTTP calls. |

## Current State

The project is in **early implementation** with a solid foundation:

- **Implemented**: Dual transport (stdio + Streamable HTTP), session management, build pipeline, tool annotation pattern, graceful shutdown, health check endpoint.
- **Planned**: Config engine, Planka client (board skeleton cache, name-to-ID resolution), 18+ core tools, response shaper, scheduling modules. See `docs/04-architecture.md` § "Project Structure" for the full planned directory layout.

## Entry Point

`src/index.ts` — Handles server bootstrap, transport selection (`--http` flag), tool registration, HTTP session management, and graceful shutdown.

## Build & Run

```bash
npm run build          # Build with tsup
npm run dev            # Watch mode (auto-rebuild)
node dist/index.js     # Run in stdio mode (default)
node dist/index.js --http             # Streamable HTTP on port 3000
node dist/index.js --http --port=8080 # Custom port
```

## Conventions

- **Logging**: Always use `process.stderr.write()` — stdout is reserved for MCP JSON-RPC protocol messages.
- **Tool annotations**: Every tool must declare `readOnlyHint`, `idempotentHint`, and `destructiveHint`.
- **Error messages**: Include available options and "did you mean?" suggestions (fail-informative, not fail-silent).
- **Card type**: Always `project`. Never expose the `story` type.
- **Status**: Managed by lists, not labels. BLOCKED is a list, not a label.
- **No secrets in responses**: API keys are never logged or returned in tool output.
