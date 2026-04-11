## Phase 19 Learnings — Remaining Tools II (`stopwatch`, `sort_list`)

- Added `src/tools/core/stopwatch.ts` as a thin wrapper over client stopwatch methods:
  - supported actions: `status`, `start`, `stop`, `reset`
  - returns compact payload with current stopwatch state (`total_seconds`, running status, formatted elapsed)
  - does not add extra persistence outside Planka card stopwatch state
- Added `src/tools/core/sort-list.ts`:
  - resolves list names semantically via resolver
  - applies configured default sort rule from `config.board.sort_rules` when field/order are omitted
  - accepts optional `field` and `order` overrides
  - explicitly rejects archive/trash sorting because those lists are endless in Planka
  - remains idempotent (same sort request yields same state)
- Updated `src/tools/core/index.ts` manifest/exports to include:
  - `stopwatch`
  - `sort_list`
- Updated shared tool client contract in `src/tools/core/shared.ts` to include stopwatch client methods used by the new wrapper.
- Extended `tests/tools/operations.test.ts` with coverage for:
  - stopwatch status/start/stop/reset behavior and compact totals
  - sort defaults from config
  - explicit field/order overrides
  - archive list rejection path

### Verification

- `npm run build` ✅ passed
- `npm test -- tests/tools/operations.test.ts` ✅ passed (7/7)
- LSP diagnostics ✅ no diagnostics in:
  - `src/tools/core/stopwatch.ts`
  - `src/tools/core/sort-list.ts`
  - `src/tools/core/index.ts`
  - `src/tools/core/shared.ts`
