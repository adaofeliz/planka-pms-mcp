# Planka PMS MCP Full Implementation Plan

## Implementation contract (freeze before coding)

This plan is grounded in `docs/04-architecture.md`, `docs/05-tool-catalog.md`, `docs/03-mcp-philosophy.md`, `docs/02-board-structure-analysis.md`, `docs/01-planka-api-reference.md`, the current `src/index.ts`, and the current package/build scaffold.

Non-negotiable implementation decisions:
- Use native Node 18+ `fetch`, not axios or node-fetch.
- Use `yaml` for config parsing and `dotenv` for local `.env` loading.
- Use `vitest` for automated tests.
- Keep board skeleton cache in-memory via a simple `Map` + TTL.
- Resolve human names to IDs with emoji-stripped, case-insensitive matching and Levenshtein suggestions.
- Centralize user-facing failures in `PlankaError` subclasses with a `suggestions` array.
- Keep progressive disclosure in a standalone shaper module; tools should return normalized raw data and delegate final field selection.
- Treat pomodoro session counts as in-memory, session-local V1 state only.
- Treat archive regex queries (`/pattern`) as MCP-side filtering after fetching archive pages; Planka itself only gets plain search text.
- Keep every phase to a single atomic commit, with no more than 5 files changed.

Global delivery rule for Sisyphus: every phase must end with a green `npm run build` and the phase-specific test command(s) listed below.

---

## Phase map

| Phase | Goal |
|---|---|
| 0 | Add test/dependency/env foundations so later phases are verifiable. |
| 1 | Build reusable utilities: logging, fuzzy matching, structured errors. |
| 2 | Add the config engine and hand-authored default board config. |
| 3 | Add the native-fetch client wrapper and initial typed API surface. |
| 4 | Complete the typed Planka client, including stopwatch and archive operations. |
| 5 | Add the board skeleton cache with TTL and preload/invalidate hooks. |
| 6 | Add name resolution with “did you mean?” suggestions. |
| 7 | Ship the first real vertical slice with `board_overview`. |
| 8 | Add `list_cards` and `get_card`. |
| 9 | Add `search_cards` and `daily_summary`. |
| 10 | Extract the shared response shaper and route existing tool formatting through it. |
| 11 | Add `create_card` and `update_card`. |
| 12 | Add `move_card` and `complete_card`. |
| 13 | Add `block_card` and `archive_card`. |
| 14 | Add due-date-window and WIP-limit scheduling primitives. |
| 15 | Add the forgiving system and `overdue_check`. |
| 16 | Replace ad-hoc tool registration with the config-aware generator for core tools. |
| 17 | Add generated workflow tools from `config.tools.generate`. |
| 18 | Add `manage_checklist`, `add_comment`, and `search_archive`. |
| 19 | Add `stopwatch` and `sort_list`. |
| 20 | Add `pomodoro` with in-memory interval state. |
| 21 | Refactor the entry point to shared bootstrap/services across stdio and HTTP. |
| 22 | Add live smoke coverage and final integration polish. |

---

## Phase 0 — Project setup and verification harness
**Goal:** add the minimum tooling so every later phase can be built, tested, and run against `.env`-backed local config.

**Prerequisites:** current repository state only.

**Files to create/modify:**
- `package.json`
- `package-lock.json`
- `vitest.config.ts`
- `.env.example`
- `tests/tooling/vitest-smoke.test.ts`

**Detailed implementation steps:**
1. Add runtime dependencies `yaml` and `dotenv`, and dev dependency `vitest`. Add scripts `test`, `test:watch`, and `test:unit` while keeping existing build/dev scripts intact.
2. Create `vitest.config.ts` with a Node test environment, clear test globs, and no coverage/reporting complexity yet. Keep it simple so future targeted test runs work with `npm test -- <path>`.
3. Expand `.env.example` to include `PLANKA_BOARD_ID` and an optional `PLANKA_CONFIG_PATH=config/default.yaml`, while preserving the existing base URL and API key placeholders.
4. Add a tiny smoke test that proves Vitest is wired correctly and that future phases can import ESM TypeScript modules under Node.
5. Do not touch runtime code yet; this phase exists only to make all future increments verifiable.

**Dependencies to add:**
- Runtime: `yaml`, `dotenv`
- Dev: `vitest`

**Acceptance criteria:**
- `npm run build` → exits 0 and still produces `dist/index.js`.
- `npm test` → exits 0 and runs the Vitest smoke test.
- `node -e "import('dotenv').then(() => import('yaml'))"` → exits 0.

**Commit message:** `chore: add test and config parsing foundation`

---

## Phase 1 — Utilities foundation
**Goal:** create the shared utility layer for logging, fuzzy matching, and structured failures before higher-level modules depend on it.

**Prerequisites:** Phase 0.

**Files to create/modify:**
- `src/utils/logger.ts`
- `src/utils/errors.ts`
- `src/utils/levenshtein.ts`
- `tests/utils/core-utils.test.ts`

**Detailed implementation steps:**
1. Implement `logger.ts` as a tiny structured logger that always writes to `process.stderr.write()`. Include a helper for scoped prefixes and a guard that makes it easy to redact sensitive fields before logging.
2. Implement `errors.ts` with a base `PlankaError` plus focused subclasses such as `ConfigError`, `ValidationError`, `NotFoundError`, and `TransitionError`. Each error should carry a `suggestions` array and a stable `code` suitable for MCP tool failures.
3. Implement `levenshtein.ts` with distance calculation plus a helper that ranks candidate names after case-folding and emoji stripping. Keep the matching logic pure so resolver tests stay fast.
4. Add unit tests covering stderr-safe logging behavior, error payload shape, and typo ranking for near matches.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/utils/core-utils.test.ts` → exits 0.

**Commit message:** `feat: add shared logger and error utilities`

---

## Phase 2 — Config engine and default board config
**Goal:** load a hand-authored YAML board configuration, resolve env placeholders, and validate it with Zod.

**Prerequisites:** Phase 1.

**Files to create/modify:**
- `src/config/types.ts`
- `src/config/schema.ts`
- `src/config/loader.ts`
- `config/default.yaml`
- `tests/config/loader.test.ts`

**Detailed implementation steps:**
1. Define concrete config types in `types.ts` for connection, list semantics, transitions, label categories, custom fields, response tiers, generated tools, cache, pomodoro, and forgiving-system settings. Keep them aligned with the design docs and current V1 scope only.
2. Implement `schema.ts` with Zod validation for the full config contract. Validate list transition references, priority ranges, due-date-window structure, tool generation shape, and required response tier arrays.
3. Implement `loader.ts` to: read YAML from disk, call `dotenv.config()` for local development, replace `${ENV_VAR}` placeholders, validate the parsed object, and return typed config. Make missing env vars fail with `ConfigError` naming the missing variable.
4. Hand-author `config/default.yaml` to match the reference GTD board semantics from the docs: INBOX → BACKLOG → NOISE/FOCUS → TODAY → ACTIVE → DONE, BLOCKED list semantics, WIP limits, due-date windows, response tier fields, and the four required generated workflow tools.
5. Add tests for successful env substitution, missing env failure, invalid config rejection, and loading `config/default.yaml` end-to-end.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/config/loader.test.ts` → exits 0.

**Commit message:** `feat: add config loader and default board config`

---

## Phase 3 — Native fetch wrapper and initial typed client
**Goal:** create the low-level Planka HTTP client wrapper with typed responses and normalized error handling.

**Prerequisites:** Phase 2.

**Files to create/modify:**
- `src/client/types.ts`
- `src/client/planka-client.ts`
- `tests/client/planka-client.test.ts`

**Detailed implementation steps:**
1. Add the minimum API types needed for board, list, card, comment, action, and included-entity responses. Keep them practical rather than exhaustive; add only the fields actually needed by the implementation plan.
2. Implement `PlankaClient` with constructor options for `baseUrl`, `apiKey`, optional `fetch` override, and optional logger. Centralize auth headers, JSON parsing, query-string building, and HTTP error normalization in a single private `request<T>()` method.
3. Implement the initial typed methods needed for read-path bootstrapping: `getBoard`, `getCard`, `getCardsByList`, `getComments`, and `getCardActions`. Support cursor pagination via `before[listChangedAt]` and `before[id]` query params.
4. Add mocked fetch tests for base URL normalization, `X-Api-Key` injection, cursor param encoding, and API error mapping into `PlankaError` subclasses.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/client/planka-client.test.ts` → exits 0.

**Commit message:** `feat: add native fetch planka client wrapper`

---

## Phase 4 — Full typed Planka client surface
**Goal:** complete the Planka client so every planned tool can rely on typed API methods rather than hand-built fetch calls.

**Prerequisites:** Phase 3.

**Files to create/modify:**
- `src/client/types.ts`
- `src/client/planka-client.ts`
- `tests/client/planka-client.test.ts`

**Detailed implementation steps:**
1. Expand the type layer to cover task lists, tasks, card labels, card memberships, custom field values, archive cards, and list-sort responses.
2. Add the write-path client methods: create/update/move cards, add/remove labels, add/remove members, create/update/delete task lists and tasks, create comments, set/clear custom field values, archive fetches, and list sorting.
3. Implement stopwatch helpers directly on the client. `startStopwatch` should preserve `total` and set `startedAt`; `stopStopwatch` should compute elapsed seconds client-side and clear `startedAt`; `resetStopwatch` should zero state; `getStopwatch` should return current derived elapsed status.
4. Pay special attention to the custom-field URL format using single colons and to archive access through the archive list endpoint. Add tests for those edge cases plus stopwatch math.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/client/planka-client.test.ts` → exits 0 and covers custom-field URL generation plus stopwatch math.

**Commit message:** `feat: complete typed planka client methods`

---

## Phase 5 — Board skeleton cache
**Goal:** cache board metadata once and reuse it across tool calls, with TTL and invalidation hooks.

**Prerequisites:** Phase 4.

**Files to create/modify:**
- `src/client/cache.ts`
- `src/client/planka-client.ts`
- `tests/client/cache.test.ts`

**Detailed implementation steps:**
1. Implement `cache.ts` as a `Map<string, CacheEntry>` keyed by board ID, where each entry contains the normalized board skeleton plus `expiresAt`. Normalize lists, labels, custom fields, field groups, members, done/archive list detection, and the board object itself.
2. Extend `PlankaClient` with `getBoardSkeleton`, `preloadBoardSkeleton`, and `invalidateBoardSkeleton`. Make cache reads reuse an in-flight fetch promise so concurrent calls during HTTP mode do not stampede the Planka API.
3. Invalidate the skeleton only for structural concerns; card-content writes should not blow away metadata unless they change something the skeleton depends on.
4. Add tests for cache hits, TTL expiry, forced refresh, and preload deduplication.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/client/cache.test.ts` → exits 0.

**Commit message:** `feat: add board skeleton cache`

---

## Phase 6 — Name resolver and suggestion errors
**Goal:** resolve human-friendly names into Planka IDs with informative failures.

**Prerequisites:** Phase 5.

**Files to create/modify:**
- `src/client/resolver.ts`
- `src/client/cache.ts`
- `src/utils/errors.ts`
- `tests/client/resolver.test.ts`

**Detailed implementation steps:**
1. Implement resolver functions for lists, labels, members, and custom fields using the cached skeleton. Matching must be case-insensitive and emoji-stripped.
2. When no exact match exists, compute likely alternatives with the Levenshtein helper and throw a `NotFoundError` that includes both `available` values and `suggestions`. When multiple candidates tie too closely, fail explicitly as ambiguous.
3. Add semantic helpers that resolve configured roles such as inbox/done/blocked/today/archive from `config.board.lists` rather than requiring every tool to know the actual visible list name.
4. Add tests for exact match, typo suggestion, emoji-insensitive matching, ambiguity, and missing semantic-role config.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/client/resolver.test.ts` → exits 0.

**Commit message:** `feat: add human name resolver with suggestions`

---

## Phase 7 — First working vertical slice: `board_overview`
**Goal:** prove the architecture end-to-end with one real MCP tool wired through config, client, cache, and resolver-backed services.

**Prerequisites:** Phase 6.

**Files to create/modify:**
- `src/tools/core/shared.ts`
- `src/tools/core/board-overview.ts`
- `src/tools/core/index.ts`
- `tests/tools/board-overview.test.ts`
- `src/index.ts`

**Detailed implementation steps:**
1. Create `shared.ts` with a `ToolContext` contract holding loaded config, client, resolver, logger, and helper functions for consistent MCP tool responses. Also add temporary normalized-output helpers so future tool phases do not duplicate card formatting logic.
2. Implement `board_overview.ts` as the first real handler. Use `getBoardSkeleton()` plus the board response to compute list counts, total cards, overdue count, and a domain-label summary, and export full MCP metadata including annotations.
3. Create `src/tools/core/index.ts` as the core tool manifest. Export the board overview tool definition in a shape that later phases can extend without changing the registration style.
4. Update `src/index.ts` to load `config/default.yaml`, build the client/cache/resolver service bundle once per process, register `board_overview`, and keep the existing transport behavior intact. Leave `hello_world` in place for now if removing it would create unnecessary churn; it will be deleted once generator-based registration lands.
5. Add a mocked handler test that proves the vertical slice returns the expected board metrics and that the tool manifest is usable from the current entry point.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/tools/board-overview.test.ts` → exits 0.

**Commit message:** `feat: add board overview vertical slice`

---

## Phase 8 — Read tools I: `list_cards` and `get_card`
**Goal:** add the core list-view and card-detail read paths on top of the working vertical slice.

**Prerequisites:** Phase 7.

**Files to create/modify:**
- `src/tools/core/list-cards.ts`
- `src/tools/core/get-card.ts`
- `src/tools/core/index.ts`
- `tests/tools/core-read.test.ts`

**Detailed implementation steps:**
1. Implement `list_cards` using resolver-backed list name lookup plus `getCardsByList`. Support optional label/priority filtering and local sorting (`position`, `due_date`, `priority`, `created`) on normalized card summaries.
2. Implement `get_card` using `getCard`, with Tier 2 as the default response and optional comment/action expansion for Tier 3. Pull comments and actions only when explicitly requested.
3. Route both handlers through the helpers in `shared.ts` so output normalization stays centralized and ready for the later shaper extraction.
4. Extend the core manifest and add tests for list resolution, filter behavior, T2 default shape, and T3 opt-in loading.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/tools/core-read.test.ts` → exits 0.

**Commit message:** `feat: add list and card detail read tools`

---

## Phase 9 — Read tools II: `search_cards` and `daily_summary`
**Goal:** add cross-board search and the daily briefing view.

**Prerequisites:** Phase 8.

**Files to create/modify:**
- `src/tools/core/search-cards.ts`
- `src/tools/core/daily-summary.ts`
- `src/tools/core/index.ts`
- `tests/tools/core-read.test.ts`

**Detailed implementation steps:**
1. Implement `search_cards` by scanning active and closed lists from the cached skeleton, calling the list-cards API per list, and applying MCP-side filters for labels, overdue state, priority, due-date presence, and list names. Deduplicate by card ID before shaping.
2. Implement `daily_summary` as an aggregate view for TODAY, ACTIVE, BLOCKED, FOCUS, overdue cards, INBOX count, and DONE items pending archive. Keep it read-only and do not introduce forgiving suggestions yet.
3. Reuse the normalization helpers in `shared.ts` so the upcoming response shaper extraction can replace formatting in one place.
4. Extend tests for board-wide search, filter intersection behavior, and daily summary section layout.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/tools/core-read.test.ts` → exits 0.

**Commit message:** `feat: add search and daily summary tools`

---

## Phase 10 — Shared response shaper foundation
**Goal:** extract progressive-disclosure shaping into a standalone module and route existing tool output through it.

**Prerequisites:** Phase 9.

**Files to create/modify:**
- `src/shaper/tiers.ts`
- `src/shaper/formatters.ts`
- `src/shaper/response-shaper.ts`
- `src/tools/core/shared.ts`
- `tests/shaper/response-shaper.test.ts`

**Detailed implementation steps:**
1. Implement `tiers.ts` so Tier 1/2/3 field sets come from config rather than being hard-coded inside tools. Expose helpers for “summary”, “detail”, and “deep” field resolution.
2. Implement `formatters.ts` for clean list names, compact dates, label names, task progress, member names, and stopwatch display values.
3. Implement `response-shaper.ts` to accept normalized raw data and return tier-appropriate payloads for cards, lists, searches, board overview, and archive results. Derived fields like `overdue`, `tasks_progress`, and `stopwatch_running` should live here.
4. Replace the temporary shaping logic in `src/tools/core/shared.ts` so all existing handlers now delegate to the standalone shaper without changing each handler file.
5. Add golden-style tests covering Tier 1, Tier 2, and Tier 3 output shapes.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/shaper/response-shaper.test.ts tests/tools/core-read.test.ts` → exits 0.

**Commit message:** `feat: extract progressive disclosure response shaper`

---

## Phase 11 — Write tools I: `create_card` and `update_card`
**Goal:** add the first card mutation tools while keeping output and validation consistent with the existing read path.

**Prerequisites:** Phase 10.

**Files to create/modify:**
- `src/tools/core/create-card.ts`
- `src/tools/core/update-card.ts`
- `src/tools/core/index.ts`
- `tests/tools/core-write.test.ts`

**Detailed implementation steps:**
1. Implement `create_card` to resolve the target list (default capture list if omitted), hard-code `type: "project"`, create the card, then optionally apply description, labels, due date, priority, and duration via follow-up API calls if those fields were supplied.
2. Implement `update_card` for scalar changes plus label add/remove operations and priority/duration clear-or-set behavior via custom fields. Support `null` semantics for clearing due date or custom fields.
3. Return shaped card data through the shared shaper path instead of embedding formatting in either handler.
4. Extend the core manifest and add write tests for default list selection, label resolution, field clearing, and safe failure when a label or field name is invalid.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/tools/core-write.test.ts` → exits 0.

**Commit message:** `feat: add create and update card tools`

---

## Phase 12 — Write tools II: `move_card` and `complete_card`
**Goal:** add workflow movement with transition validation and semantic completion.

**Prerequisites:** Phase 11.

**Files to create/modify:**
- `src/tools/core/move-card.ts`
- `src/tools/core/complete-card.ts`
- `src/tools/core/index.ts`
- `tests/tools/core-write.test.ts`

**Detailed implementation steps:**
1. Implement `move_card` using semantic source/target list names, config-defined transition validation, top/bottom position mapping, and a post-move resort of the destination list when the configured sort rule would otherwise be violated.
2. Implement `complete_card` as a thin semantic wrapper that resolves the configured DONE list and delegates to the movement path. Return a confirmation payload that includes the completion timestamp and reminds the caller that archival is explicit.
3. Keep transition failures informative by naming the current list, attempted target, and allowed transitions.
4. Extend tests for invalid transitions, closed-list behavior, and destination-list resort calls.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/tools/core-write.test.ts` → exits 0.

**Commit message:** `feat: add move and complete card tools`

---

## Phase 13 — Write tools III: `block_card` and `archive_card`
**Goal:** finish the remaining core workflow write tools around blockers and archival.

**Prerequisites:** Phase 12.

**Files to create/modify:**
- `src/tools/core/block-card.ts`
- `src/tools/core/archive-card.ts`
- `src/tools/core/index.ts`
- `tests/tools/core-write.test.ts`

**Detailed implementation steps:**
1. Implement `block_card` as a composed write handler that resolves the BLOCKED list, moves the card, and adds a reason comment in the same tool execution. Keep the comment text explicit so the blocker is visible in future card history.
2. Implement `archive_card` by verifying the card is currently in DONE, resolving the archive list from the skeleton, moving the card there, and returning archive confirmation data. Do not allow archiving directly from non-DONE lists.
3. Reuse existing movement helpers rather than duplicating list validation logic.
4. Extend tests for wrong-source archive failures, move-then-comment sequencing, and archive confirmation shape.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/tools/core-write.test.ts` → exits 0.

**Commit message:** `feat: add block and archive card tools`

---

## Phase 14 — Scheduling primitives: due-date windows and WIP limits
**Goal:** add the pure scheduling logic that daily planning and generated tools will depend on.

**Prerequisites:** Phase 13.

**Files to create/modify:**
- `src/scheduling/due-date-windows.ts`
- `src/scheduling/wip-limits.ts`
- `src/tools/core/daily-summary.ts`
- `tests/scheduling/scheduling.test.ts`

**Detailed implementation steps:**
1. Implement `due-date-windows.ts` as pure functions that classify cards into backlog-safe, approaching, imminent, and overdue windows from config. Treat missing due dates as unscheduled rather than errors.
2. Implement `wip-limits.ts` as pure checks against current list occupancy for NOISE and FOCUS using configured caps. Return structured results the caller can include in warnings or generator guards.
3. Update `daily_summary` to surface approaching/imminent promotion suggestions and WIP-limit warnings without mutating any list membership.
4. Add tests for window boundaries, null due dates, and over-capacity warnings.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/scheduling/scheduling.test.ts tests/tools/core-read.test.ts` → exits 0.

**Commit message:** `feat: add scheduling windows and wip checks`

---

## Phase 15 — Forgiving system and `overdue_check`
**Goal:** add the overdue-analysis engine and expose it through a dedicated read-only tool.

**Prerequisites:** Phase 14.

**Files to create/modify:**
- `src/scheduling/forgiving.ts`
- `src/tools/core/overdue-check.ts`
- `src/tools/core/daily-summary.ts`
- `src/tools/core/index.ts`
- `tests/tools/overdue-check.test.ts`

**Detailed implementation steps:**
1. Implement `forgiving.ts` as pure suggestion logic that accepts overdue cards plus TODAY workload and returns structured suggestions like `deprioritize_today`, `split_duration`, and `reassess_relevance`. Never emit a suggestion that changes another task’s due date.
2. Implement `overdue_check` as a read-only tool that lists overdue cards, warnings, and the forgiving-system suggestions. Keep the tool non-mutating and explicit that human approval is required for any follow-up action.
3. Update `daily_summary` to include the same forgiving suggestions whenever overdue items are present, so the user sees a consistent planning experience.
4. Add tests for stale-task warnings, priority-aware suggestions, and the “never extend other due dates” rule.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/tools/overdue-check.test.ts tests/tools/core-read.test.ts` → exits 0.

**Commit message:** `feat: add forgiving overdue analysis`

---

## Phase 16 — Core tool generator
**Goal:** stop hand-registering tools and switch to a config-aware generator for the current core tool set.

**Prerequisites:** Phase 15.

**Files to create/modify:**
- `src/tools/generator.ts`
- `src/tools/core/index.ts`
- `src/index.ts`
- `tests/tools/generator.test.ts`

**Detailed implementation steps:**
1. Implement `generator.ts` to accept the loaded config plus the core tool manifest and return MCP registration objects with name, description, Zod input schema, annotations, and bound handler.
2. Extend `src/tools/core/index.ts` so each core tool exports enough metadata for generator-driven registration. Add a generator-side assertion that every tool has `readOnlyHint`, `idempotentHint`, and `destructiveHint` defined.
3. Update `src/index.ts` to register tools through the generator instead of hard-coded calls. Remove the placeholder `hello_world` once the generated core tool set is live.
4. Add tests for duplicate tool names, missing annotations, and stable registration ordering.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/tools/generator.test.ts` → exits 0.

**Commit message:** `feat: generate core tool registrations`

---

## Phase 17 — Generated workflow tools
**Goal:** generate the config-driven composed workflow tools instead of hand-coding them as separate MCP registrations.

**Prerequisites:** Phase 16.

**Files to create/modify:**
- `src/tools/generator.ts`
- `config/default.yaml`
- `tests/tools/generator.test.ts`

**Detailed implementation steps:**
1. Extend `generator.ts` so `config.tools.generate` can produce runtime handlers that compose existing internal executors directly, without round-tripping through MCP transport calls.
2. Implement the four required workflow tools: `triage_card`, `schedule_for_today`, `start_working`, and `park_as_noise`. `triage_card` must enforce all required metadata when leaving INBOX; `start_working` must chain move-to-ACTIVE plus stopwatch start; `park_as_noise` must respect WIP limits.
3. Finalize the tool-generation section of `config/default.yaml` so descriptions, defaults, and required params match the actual generated behavior.
4. Add tests for default param merging, execution order, missing triage metadata, and WIP-limit enforcement.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/tools/generator.test.ts` → exits 0.

**Commit message:** `feat: add generated workflow tools`

---

## Phase 18 — Remaining tools I: checklist, comments, archive search
**Goal:** cover the remaining collaboration/history tools that do not depend on pomodoro state.

**Prerequisites:** Phase 17.

**Files to create/modify:**
- `src/tools/core/manage-checklist.ts`
- `src/tools/core/add-comment.ts`
- `src/tools/core/search-archive.ts`
- `src/tools/core/index.ts`
- `tests/tools/operations.test.ts`

**Detailed implementation steps:**
1. Implement `manage_checklist` as a small action router over task-list/task endpoints: `add_list`, `add_task`, `toggle_task`, `delete_task`, and `delete_list`. Re-fetch the card or task-list state after each mutation so callers get a coherent updated checklist summary.
2. Implement `add_comment` with plain markdown passthrough and a compact confirmation payload that includes the card ID, card name when available, and created comment metadata.
3. Implement `search_archive` against `GET /api/lists/:archiveListId/cards`, honoring normal text search when `query` is plain text and applying MCP-side regex filtering only when the query starts with `/`. Support label filters, limit, cursor pagination, and archive ordering by `listChangedAt`.
4. Register the new tools and add tests for checklist action validation, regex filtering behavior, and archive pagination semantics.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/tools/operations.test.ts` → exits 0.

**Commit message:** `feat: add checklist comment and archive search tools`

---

## Phase 19 — Remaining tools II: `stopwatch` and `sort_list`
**Goal:** expose raw time tracking and explicit list sorting as standalone tools.

**Prerequisites:** Phase 18.

**Files to create/modify:**
- `src/tools/core/stopwatch.ts`
- `src/tools/core/sort-list.ts`
- `src/tools/core/index.ts`
- `tests/tools/operations.test.ts`

**Detailed implementation steps:**
1. Implement `stopwatch` as a thin wrapper around the client stopwatch methods. Support `start`, `stop`, `reset`, and `status`, and always return current derived elapsed/total values in a compact shape.
2. Implement `sort_list` using semantic list lookup plus the configured default sort rule, while allowing optional field/order overrides. Reject archive or trash lists explicitly because Planka cannot sort endless lists.
3. Ensure `stopwatch` does not create any extra persistence beyond what Planka already stores on the card, and keep sort logic idempotent.
4. Extend tests for elapsed formatting, reset behavior, configured sort defaults, and archive/trash rejection.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/tools/operations.test.ts` → exits 0.

**Commit message:** `feat: add stopwatch and list sorting tools`

---

## Phase 20 — Remaining tools III: `pomodoro`
**Goal:** add pomodoro interval management as a separate tool layered on top of the native stopwatch.

**Prerequisites:** Phase 19.

**Files to create/modify:**
- `src/scheduling/pomodoro.ts`
- `src/tools/core/pomodoro.ts`
- `src/tools/core/index.ts`
- `tests/tools/pomodoro.test.ts`

**Detailed implementation steps:**
1. Implement `src/scheduling/pomodoro.ts` as an in-memory tracker keyed by card ID that stores the current phase (`work` or `rest`), started-at timestamp, configured interval, and session count for the current day. Do not add persistence across restarts.
2. Implement the `pomodoro` tool with actions `start_work`, `start_rest`, `status`, and `stop`. Use config defaults unless the caller supplies interval overrides, and coordinate with the raw stopwatch tool/client so tracked time still lives in Planka.
3. Keep the response concise: current phase, elapsed, remaining, interval, and `sessions_today`. Resetting the Node process must reset `sessions_today`; that is expected V1 behavior.
4. Add tests for work/rest transitions, remaining-time math, day-boundary session counts, and the explicit non-persistence behavior.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test -- tests/tools/pomodoro.test.ts` → exits 0.

**Commit message:** `feat: add pomodoro workflow tool`

---

## Phase 21 — Entry point refactor and shared services
**Goal:** extract bootstrap and transport startup so stdio and HTTP share the same long-lived services and caches.

**Prerequisites:** Phase 20.

**Files to create/modify:**
- `src/index.ts`
- `src/bootstrap.ts`
- `src/http-server.ts`
- `src/stdio-server.ts`
- `src/service-container.ts`

**Detailed implementation steps:**
1. Move argument parsing, config loading, logger creation, client/cache/resolver setup, shaper construction, pomodoro tracker creation, and generated-tool assembly into `src/bootstrap.ts` plus `src/service-container.ts`. The service container should be process-scoped, not per HTTP request.
2. Extract stdio startup into `src/stdio-server.ts` and HTTP startup into `src/http-server.ts`, both consuming the same service container. Preserve the existing health endpoint, session handling, and graceful shutdown behavior.
3. Add support for `--config=...` while keeping `--http` and `--port=`. Default config path should remain `config/default.yaml` unless overridden.
4. Ensure HTTP-mode requests reuse the same board skeleton cache and resolver state across sessions, matching the documented design constraint.
5. Keep `src/index.ts` as the smallest possible bootstrap launcher that selects transport and wires shutdown.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test` → exits 0.
- `node dist/index.js --http --port=3100 & PID=$!; sleep 2; curl -sf http://localhost:3100/health | grep -q '"status":"ok"'; kill $PID` → exits 0.

**Commit message:** `refactor: extract shared bootstrap and transport startup`

---

## Phase 22 — Final integration and polish
**Goal:** close the loop with live smoke coverage, preload polish, and user-facing documentation for the finished server.

**Prerequisites:** Phase 21.

**Files to create/modify:**
- `package.json`
- `package-lock.json`
- `README.md`
- `tests/live/planka-smoke.test.ts`
- `src/bootstrap.ts`

**Detailed implementation steps:**
1. Add a `test:live` script gated by explicit env vars so live smoke tests only run when a real Planka instance is available. Keep the default `npm test` suite fully mocked and safe for CI/local offline use.
2. Implement `tests/live/planka-smoke.test.ts` to cover the highest-risk API contracts: cursor pagination, custom-field single-colon URLs, stopwatch start/stop round-trip, and one generated workflow tool (`triage_card` or `start_working`) against a disposable test board/card.
3. Update `src/bootstrap.ts` so cache preload runs on startup when `config.cache.preload` is true, and so startup failures for missing env vars or invalid config are explicit and secret-safe.
4. Update `README.md` with final local-development usage: config path selection, stdio/HTTP mode, generated workflow tools, and how to run live smoke tests safely.
5. Run the full build + mocked tests locally, then run live smoke tests only if valid Planka env vars are present.

**Dependencies to add:**
- None

**Acceptance criteria:**
- `npm run build` → exits 0.
- `npm test` → exits 0.
- `PLANKA_LIVE_TESTS=1 npm run test:live` → exits 0 when valid live-test env vars and a disposable Planka board are configured.

**Commit message:** `chore: add live smoke tests and final polish`

---

## Final notes for Sisyphus

- Do not collapse phases. The file-count cap is deliberate so each commit stays reviewable and reversible.
- Prefer extending the shared helpers (`shared.ts`, shaper, generator, service container) over creating more one-off abstractions.
- When a tool needs behavior already present in another handler, extract the shared operation into a small local helper rather than invoking MCP internally.
- Keep tests close to the risk: pure scheduling/config logic gets unit tests; API contract edges get mocked client tests; a small live suite catches the documented Planka quirks.
- The repo should remain usable after every phase: build green, tests green, and no placeholder breakage left behind.
