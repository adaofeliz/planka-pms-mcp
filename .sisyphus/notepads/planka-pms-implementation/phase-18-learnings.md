## Phase 18 Learnings — Remaining Tools I (Checklist, Comments, Archive Search)

- Added `src/tools/core/manage-checklist.ts`:
  - action router with supported operations:
    - `add_list`
    - `add_task`
    - `toggle_task`
    - `delete_task`
    - `delete_list`
  - validates required action-specific inputs
  - re-fetches card state after mutation and returns coherent checklist summary
- Added `src/tools/core/add-comment.ts`:
  - markdown passthrough comment creation
  - compact confirmation payload includes:
    - `card_id`
    - `card_name`
    - created comment metadata (`id`, `text`, `user_id`, `created_at`)
- Added `src/tools/core/search-archive.ts`:
  - archive retrieval via archive list endpoint (`getArchivedCards` when available)
  - plain text mode: forwards search query to server-side search
  - regex mode: enabled only when query starts with `/`, then applies MCP-side regex filtering
  - supports label filters, `limit`, and cursor pagination (`before_list_changed_at` + `before_id`)
  - stable archive ordering by `listChangedAt` descending
- Updated `src/tools/core/index.ts`:
  - registered/exported new tools in core manifest for generator registration
- Extended shared client contract in `src/tools/core/shared.ts` for checklist/archive support methods.

### Tests

- Added `tests/tools/operations.test.ts` covering:
  - checklist action validation
  - task toggle with refreshed summary
  - add-comment confirmation shape
  - regex filtering behavior in archive search
  - label filter + limit + cursor pagination semantics

### Verification

- `npm run build` ✅ passed
- `npm test -- tests/tools/operations.test.ts` ✅ passed (5/5)
- LSP diagnostics ✅ no diagnostics in:
  - `src/tools/core/manage-checklist.ts`
  - `src/tools/core/add-comment.ts`
  - `src/tools/core/search-archive.ts`
  - `src/tools/core/index.ts`
