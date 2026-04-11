## Phase 14 Learnings — Scheduling Primitives (Due-Date Windows + WIP Limits)

- Added `src/scheduling/due-date-windows.ts` as pure scheduling utilities:
  - `classifyDueDate()` classifies each card into:
    - `unscheduled`
    - `overdue`
    - `imminent`
    - `approaching`
    - `backlog_safe`
  - `groupCardsByDueDateWindow()` groups cards by those buckets in one pass
  - missing/invalid/null due dates are treated as `unscheduled`, never as errors
- Added `src/scheduling/wip-limits.ts` as pure WIP evaluation logic:
  - `evaluateConfiguredWipLimits()` computes status objects for configured caps
  - `getWipWarnings()` converts over-capacity statuses into warning payloads
  - currently used for NOISE/FOCUS (and supports any configured role)
- Updated `src/tools/core/daily-summary.ts` to surface scheduling insights without mutating list state:
  - due-window counts (`overdue`, `imminent`, `approaching`, `backlog_safe`, `unscheduled`)
  - promotion suggestions for imminent/approaching cards
  - WIP statuses and warnings from configured limits
  - gracefully handles missing optional NOISE/FOCUS lists on the board
- Added `tests/scheduling/scheduling.test.ts` covering:
  - window boundary classification
  - null due-date handling
  - grouped bucket totals
  - over-capacity WIP warnings
- Extended `tests/tools/core-read.test.ts` with daily summary scheduling/WIP assertions.

### Verification

- `npm run build` ✅ passed
- `npm test -- tests/scheduling/scheduling.test.ts tests/tools/core-read.test.ts` ✅ passed (9/9)
- LSP diagnostics ✅ no diagnostics in:
  - `src/scheduling/due-date-windows.ts`
  - `src/scheduling/wip-limits.ts`
  - `src/tools/core/daily-summary.ts`
