## Phase 13 Learnings — Write Tools III (`block_card`, `archive_card`)

- Added `src/tools/core/block-card.ts`:
  - composed write handler that reuses `move_card` path for transition-aware movement into BLOCKED
  - appends explicit blocker comment in same execution (`Blocked reason: ...`)
  - returns combined confirmation payload with movement data and blocker comment text
- Added `src/tools/core/archive-card.ts`:
  - validates source state by requiring the card to be in DONE before archival
  - resolves archive list from cached board skeleton/resolver
  - moves card to archive list and returns archive confirmation metadata
  - rejects wrong-source archival attempts with informative `TransitionError`
- Updated `src/tools/core/index.ts` exports/manifest:
  - includes `block_card`
  - includes `archive_card`
- Updated `src/tools/core/shared.ts` tool client contract for composed write flows:
  - added `createComment` typing for blocker-comment operation

### Tests

- Extended `tests/tools/core-write.test.ts` with Phase 13 coverage for:
  - move-then-comment sequencing behavior for `block_card`
  - wrong-source archive failure (`TransitionError`)
  - successful DONE-to-archive confirmation payload shape

### Verification

- `npm run build` ✅ passed
- `npm test -- tests/tools/core-write.test.ts` ✅ passed (16/16)
- LSP diagnostics ✅ no diagnostics in:
  - `src/tools/core/block-card.ts`
  - `src/tools/core/archive-card.ts`
  - `src/tools/core/index.ts`
  - `src/tools/core/shared.ts`
