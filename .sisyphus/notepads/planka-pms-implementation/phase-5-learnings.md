## Phase 5 Learnings — Board Skeleton Cache

- Added `src/client/cache.ts` with a focused in-memory board skeleton cache:
  - `BoardSkeletonCache` uses `Map<string, CacheEntry>` keyed by board ID.
  - TTL-based expiration via `expiresAt` with lazy eviction on read.
  - `normalizeBoardSkeleton()` extracts reusable metadata from board payloads:
    - board info
    - lists, labels, custom field groups/fields, members, cards
    - detected `doneListId` (`closed`) and `archiveListId` (`archive`)
- Extended `src/client/planka-client.ts` with skeleton cache integration:
  - `getBoardSkeleton(boardId, forceRefresh?)`
  - `preloadBoardSkeleton(boardId)`
  - `invalidateBoardSkeleton(boardId)`
  - Added in-flight dedupe map so concurrent requests share one fetch and avoid API stampedes.
  - Added optional `boardSkeletonTtlMs` client option (default 300000 ms).
- Added `tests/client/cache.test.ts` with behavior coverage:
  - cache hit reuse (single fetch)
  - TTL expiry refresh
  - force-refresh bypass
  - preload + read deduplication using one in-flight fetch

### Verification

- `npm run build` ✅ passed
- `npm test -- tests/client/cache.test.ts` ✅ passed (4/4)
- LSP diagnostics ✅ clean for:
  - `src/client/cache.ts`
  - `src/client/planka-client.ts`
