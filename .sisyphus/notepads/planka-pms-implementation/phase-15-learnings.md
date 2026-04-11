## Phase 15 Learnings — Forgiving System + `overdue_check`

- Added `src/scheduling/forgiving.ts` as pure overdue-suggestion logic:
  - input: overdue cards + TODAY workload + forgiving config rules
  - outputs:
    - warnings
    - structured suggestions (`deprioritize_today`, `split_duration`, `reassess_relevance`)
  - enforces safety principle: never suggests extending other tasks' due dates
- Added `src/tools/core/overdue-check.ts` as read-only overdue analysis tool:
  - scans overdue cards from cached skeleton
  - enriches each overdue card with priority/duration values from card custom fields
  - computes stale warnings and forgiving suggestions
  - returns explicit non-mutating guidance with `requires_human_approval: true`
- Updated `src/tools/core/daily-summary.ts` to include forgiving output whenever overdue cards are present:
  - added `forgiving.warnings`
  - added `forgiving.suggestions`
- Updated `src/tools/core/index.ts` to export/include `overdue_check`.

### Tests

- Added `tests/tools/overdue-check.test.ts` covering:
  - stale-task warnings
  - priority-aware suggestions
  - split-duration suggestions
  - reassess-relevance suggestions
  - explicit "never extend other due dates" warning
- Updated `tests/tools/core-read.test.ts` to validate daily summary forgiving payload presence.

### Verification

- `npm run build` ✅ passed
- `npm test -- tests/tools/overdue-check.test.ts tests/tools/core-read.test.ts` ✅ passed (6/6)
- LSP diagnostics ✅ no diagnostics in:
  - `src/scheduling/forgiving.ts`
  - `src/tools/core/overdue-check.ts`
  - `src/tools/core/daily-summary.ts`
  - `src/tools/core/index.ts`
