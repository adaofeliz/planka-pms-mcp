## Phase 3 Learnings — Native Fetch Client Wrapper

- Added initial typed client surface in `src/client/`:
  - `types.ts` for board/list/card/comment/action shapes and API envelope helpers (`item` / `items`).
  - `planka-client.ts` with a reusable `request<T>()` path that centralizes:
    - base URL normalization (trailing slash stripping)
    - `X-Api-Key` auth header injection
    - query-string construction (including cursor keys like `before[listChangedAt]` and `before[id]`)
    - JSON parsing and error normalization
- Implemented read-path methods required for early tool bootstrapping:
  - `getBoard`
  - `getCard`
  - `getCardsByList`
  - `getComments`
  - `getCardActions`
- Error mapping behavior now provides typed failures:
  - `404` → `NotFoundError`
  - `400` / `422` → `ValidationError`
  - all other non-2xx statuses → `ApiError`
- Added mocked tests in `tests/client/planka-client.test.ts` for:
  - base URL normalization
  - `X-Api-Key` header injection
  - cursor query parameter encoding
  - HTTP status to typed error mapping

### Verification

- `npm run build` ✅ passed
- `npm test -- tests/client/planka-client.test.ts` ✅ passed (5/5)
- LSP diagnostics ✅ clean for:
  - `src/client/types.ts`
  - `src/client/planka-client.ts`
