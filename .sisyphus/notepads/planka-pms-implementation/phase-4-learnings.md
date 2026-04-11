## Phase 4 Learnings — Full Typed Planka Client Surface

- Expanded client typing and request surface for write-path operations so upcoming tools can call typed methods instead of hand-rolled fetch logic.
- Added richer `src/client/types.ts` contracts for:
  - task lists/tasks
  - card labels/card memberships
  - custom field values
  - list sort result
  - create/update payloads for cards, tasks, and task lists
  - stopwatch status shape with derived elapsed seconds
- Extended `src/client/planka-client.ts` with write and utility methods:
  - card lifecycle: `createCard`, `updateCard`, `moveCard`
  - label/member links: `addLabelToCard`, `removeLabelFromCard`, `addMemberToCard`, `removeMemberFromCard`
  - checklist APIs: `createTaskList`, `updateTaskList`, `deleteTaskList`, `createTask`, `updateTask`, `deleteTask`
  - comments/custom fields/sort: `createComment`, `setCustomFieldValue`, `clearCustomFieldValue`, `sortList`
  - archive read path: `getArchiveCards` via archive list endpoint
  - stopwatch helpers: `getStopwatch`, `startStopwatch`, `stopStopwatch`, `resetStopwatch`
- Implemented deterministic stopwatch math via optional `now()` injection in client options for stable unit testing.
- Confirmed custom-field value URLs use single-colon separators (`customFieldGroupId:{gid}:customFieldId:{fid}`) in request paths.

### Verification

- `npm run build` ✅ passed
- `npm test -- tests/client/planka-client.test.ts` ✅ passed (11/11)
- LSP diagnostics ✅ clean for:
  - `src/client/types.ts`
  - `src/client/planka-client.ts`
