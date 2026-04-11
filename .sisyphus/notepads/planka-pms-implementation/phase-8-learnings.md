## Phase 8 Learnings — Core Read Tools (`list_cards`, `get_card`)

- Added `src/tools/core/list-cards.ts`:
  - resolves list names through resolver-backed semantic matching
  - fetches list cards via `client.getCardsByList`
  - supports optional label and priority filtering
  - supports local sorting by `position`, `due_date`, `priority`, and `created`
  - returns normalized card summaries through shared helpers
- Added `src/tools/core/get-card.ts`:
  - defaults to Tier 2-style detail payload from `client.getCard`
  - supports Tier 3 opt-in expansion for comments/actions
  - lazily fetches comments/actions only when requested
- Updated `src/tools/core/index.ts` manifest exports and tool names:
  - `board_overview`
  - `list_cards`
  - `get_card`
- Updated `src/tools/core/shared.ts` compatibility utilities:
  - exported `ToolResult`, `toTextResult`, and `isOverdue`
  - preserved/extended normalization helpers used by read tools

### Tests

- Added `tests/tools/core-read.test.ts` covering:
  - resolver-based list lookup
  - label/priority filtering behavior
  - T2 default card shape
  - T3 opt-in comment/action loading behavior

### Verification

- `npm run build` ✅ passed
- `npm test -- tests/tools/core-read.test.ts` ✅ passed (2/2)
- LSP diagnostics ✅ clean for:
  - `src/tools/core/list-cards.ts`
  - `src/tools/core/get-card.ts`
  - `src/tools/core/index.ts`
  - `src/tools/core/shared.ts`
