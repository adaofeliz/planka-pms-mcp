## Phase 12 Learnings — Write Tools II (`move_card`, `complete_card`)

- Added `src/tools/core/move-card.ts`:
  - resolves semantic target list names through resolver
  - validates transitions against `config.board.transitions`
  - maps position semantics (`top` -> numeric position, `bottom` -> default append)
  - raises informative `TransitionError` including current role, attempted target role, and allowed targets
  - triggers destination resort via configured `sort_rules` when explicit position move is requested
- Added `src/tools/core/complete-card.ts`:
  - thin semantic wrapper over movement path
  - resolves configured DONE list and delegates to shared move execution
  - returns completion payload with timestamp and explicit archival reminder
- Updated shared tool client contract in `src/tools/core/shared.ts` to include movement/sort operations used by these handlers.
- Updated `src/tools/core/index.ts` to export and include:
  - `move_card`
  - `complete_card`
- Extended `tests/tools/core-write.test.ts` for Phase 12 behavior:
  - invalid transition failure with `TransitionError`
  - destination resort call when configured sort rule applies
  - semantic completion confirmation shape

### Verification

- `npm run build` ✅ passed
- `npm test -- tests/tools/core-write.test.ts` ✅ passed (7/7)
- LSP diagnostics ✅ no diagnostics in:
  - `src/tools/core/move-card.ts`
  - `src/tools/core/complete-card.ts`
  - `src/tools/core/index.ts`
  - `src/tools/core/shared.ts`
