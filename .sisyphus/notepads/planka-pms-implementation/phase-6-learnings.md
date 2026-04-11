## Phase 6 Learnings — Name Resolver and Suggestion Errors

- Added `src/client/resolver.ts` with a dedicated `NameResolver` for human-friendly lookup over cached board skeleton entities.
- Matching behavior now consistently normalizes names by:
  - emoji stripping
  - punctuation/symbol cleanup
  - whitespace collapsing
  - case folding
- Resolver supports IDs for:
  - lists (`resolveListId`)
  - labels (`resolveLabelId`)
  - members (`resolveMemberId`, including username aliases)
  - custom fields (`resolveCustomFieldId`)
- Added semantic role helpers backed by config mapping:
  - `resolveInboxListId`, `resolveDoneListId`, `resolveBlockedListId`, `resolveTodayListId`, `resolveArchiveListId`
- Failure behavior:
  - missing entities -> `NotFoundError` with full `available` and fuzzy `suggestions`
  - close-prefix or tie ambiguity -> explicit `AmbiguousMatchError`
  - missing semantic list role config -> `ConfigError`
- Extended error model in `src/utils/errors.ts` with `AmbiguousMatchError` (`code: AMBIGUOUS_MATCH`) including `matches` payload.

### Tests

- Added `tests/client/resolver.test.ts` covering:
  - exact list resolution
  - emoji-insensitive matching
  - typo suggestions (`bakclog` -> suggests BACKLOG)
  - ambiguity detection
  - missing semantic-role mapping failure

### Verification

- `npm run build` ✅ passed
- `npm test -- tests/client/resolver.test.ts` ✅ passed (5/5)
- LSP diagnostics ✅ no diagnostics in:
  - `src/client/resolver.ts`
  - `src/utils/errors.ts`
  - `src/client/cache.ts`
