## Phase 7 Learnings — First Vertical Slice (`board_overview`)

- Added a core tool context foundation in `src/tools/core/shared.ts`:
  - `ToolContext` with config, board ID, cached client access, resolver factory, logger, and optional clock override.
  - reusable output helper `toTextResult()` for consistent MCP text payloads.
  - shared `isOverdue()` utility for date-aware card summaries.
- Implemented the first production semantic tool in `src/tools/core/board-overview.ts`:
  - reads board skeleton through cache-aware client path
  - resolves semantic list roles via resolver/config
  - computes list counts, total cards, overdue cards, and domain-label distribution
  - exports tool metadata including read-only/idempotent annotations
- Added `src/tools/core/index.ts` as an extendable core manifest exporting `coreTools`.
- Updated `src/index.ts` to wire config + services once per process and register `board_overview` alongside existing `hello_world`:
  - loads config from `PLANKA_CONFIG_PATH` (fallback `config/default.yaml`)
  - constructs logger/client with cache TTL from config
  - creates resolver instances from current cached skeleton
  - shares one service bundle across stdio and HTTP sessions
- Extended cache normalization in `src/client/cache.ts` to include `cardLabels`, enabling domain-label summary in overview output.

### Tests

- Added `tests/tools/board-overview.test.ts` covering:
  - expected board metrics payload (totals, overdue count, list counts, domain labels)
  - manifest export usability (`coreTools` contains `board_overview`)

### Verification

- `npm run build` ✅ passed
- `npm test -- tests/tools/board-overview.test.ts` ✅ passed (2/2)
- LSP diagnostics ✅ no diagnostics in:
  - `src/index.ts`
  - `src/client/cache.ts`
  - `src/tools/core/shared.ts`
  - `src/tools/core/board-overview.ts`
  - `src/tools/core/index.ts`
