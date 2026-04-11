## Phase 17 Learnings — Generated Workflow Tools

- Extended `src/tools/generator.ts` so it now emits both:
  - core tool registrations from `coreToolDefinitions`
  - workflow tool registrations from `config.tools.generate`
- Implemented generated runtime handlers (composed in-process, no MCP transport round-trip):
  - `triage_card`:
    - merges defaults + user params
    - enforces required triage metadata from config
    - composes `move_card` then `update_card`
  - `schedule_for_today`:
    - merges defaults
    - composes `move_card`
  - `start_working`:
    - composes `move_card`
    - then starts stopwatch via client stopwatch API
  - `park_as_noise`:
    - checks NOISE WIP limit before movement
    - composes `move_card` only when under cap
- Kept duplicate-name and annotation validations active across both core and generated registrations.
- Updated `config/default.yaml` tool metadata for alignment (`start_working.composed_of` now reflects `start_stopwatch`).

### Tests

- Extended `tests/tools/generator.test.ts` to cover:
  - default parameter merging in generated tools
  - composed execution order (`move_card` then `update_card` for triage)
  - missing triage metadata rejection
  - WIP-limit enforcement for `park_as_noise`

### Verification

- `npm run build` ✅ passed
- `npm test -- tests/tools/generator.test.ts` ✅ passed (7/7)
- LSP diagnostics ✅ no diagnostics in:
  - `src/tools/generator.ts`
  - `src/tools/core/index.ts`
  - `src/index.ts`
