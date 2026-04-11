## Phase 9 Learnings — Read Tools II (`search_cards`, `daily_summary`)

- Added `src/tools/core/search-cards.ts`:
  - scans active/closed lists from cached board skeleton
  - fetches list cards per list using `getCardsByList`
  - deduplicates cards by ID across list scans
  - applies MCP-side filters for labels, overdue, priority, due-date presence, and list names
  - returns normalized card summaries through shared tool helpers
- Added `src/tools/core/daily-summary.ts`:
  - computes daily briefing totals for TODAY, ACTIVE, BLOCKED, FOCUS, overdue, INBOX, and DONE pending archive
  - stays read-only and does not include forgiving-system suggestions yet
  - gracefully handles missing configured focus list on the current board by reporting zero instead of failing
- Updated `src/tools/core/index.ts` manifest exports and tool name set:
  - includes `search_cards` and `daily_summary`
- Extended `tests/tools/core-read.test.ts`:
  - verifies cross-list search behavior, deduplication, and filter intersection
  - verifies daily summary section totals and layout expectations

### Verification

- `npm run build` ✅ passed
- `npm test -- tests/tools/core-read.test.ts` ✅ passed (4/4)
- LSP diagnostics ✅ clean for:
  - `src/tools/core/search-cards.ts`
  - `src/tools/core/daily-summary.ts`
  - `src/tools/core/shared.ts`
  - `src/tools/core/index.ts`
