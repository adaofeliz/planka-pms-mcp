## Phase 11 Learnings — Write Tools I (`create_card`, `update_card`)

- Added `src/tools/core/create-card.ts`:
  - resolves target list by explicit `list` or config `default_capture_list`
  - hard-codes new card type to `project`
  - performs follow-up mutations for optional description, due date, labels, priority, and duration
  - resolves labels/custom fields through the resolver for safe name-based behavior
  - supports null semantics for custom field clearing
  - returns shaped card output through shared shaper-backed helper path
- Added `src/tools/core/update-card.ts`:
  - supports scalar updates (`name`, `description`, `due_date` including `null` clear)
  - supports label add/remove operations
  - supports priority/duration clear-or-set via custom field APIs
  - returns shaped card output through shared shaper-backed helper path
- Updated `src/tools/core/shared.ts` client contract to include write-path operations required by new tools:
  - `createCard`, `updateCard`, `addCardLabel`, `removeCardLabel`, `setCustomFieldValue`, `clearCustomFieldValue`
- Updated `src/tools/core/index.ts` manifest exports to include:
  - `create_card`
  - `update_card`
- Added tests in `tests/tools/core-write.test.ts` for:
  - default list selection on create
  - label resolution and follow-up metadata writes
  - null clearing behavior for due date and custom fields
  - safe failures when label/custom-field names are invalid (`NotFoundError`)

### Verification

- `npm run build` ✅ passed
- `npm test -- tests/tools/core-write.test.ts` ✅ passed (4/4)
- LSP diagnostics ✅ clean for:
  - `src/tools/core/create-card.ts`
  - `src/tools/core/update-card.ts`
  - `src/tools/core/index.ts`
  - `src/tools/core/shared.ts`
