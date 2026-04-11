# Project Bootstrap: planka-pms-mcp

## TL;DR

> **Quick Summary**: Bootstrap the planka-pms-mcp project from an empty git repo with docs into a build-ready, npm-publishable MCP Hello World server with a public GitHub remote.
> 
> **Deliverables**:
> - `.gitignore` protecting secrets
> - `package.json` configured for `@adflz/planka-pms-mcp` with bin/npx support
> - `tsconfig.json` + `tsup` build config for ESM TypeScript
> - `src/index.ts` — MCP Hello World with one `hello_world` dummy tool (stdio transport)
> - Public GitHub repo at `adaofeliz/planka-pms-mcp` with all code pushed
> - Initial commit history including existing `docs/` folder
> 
> **Estimated Effort**: Short (1-2 hours)
> **Parallel Execution**: YES — 2 waves + final verification
> **Critical Path**: Preflight → .gitignore → Package scaffold → MCP server → GitHub remote → Push

---

## Context

### Original Request
User wants to start implementation of their Planka PMS MCP project. First step: create git files (.gitignore), project boilerplate (a simple MCP Hello World), and use `gh` CLI to create a GitHub repo configured for npm publishing as `@adflz/planka-pms-mcp`, installable via `npx -y @adflz/planka-pms-mcp`.

### Interview Summary
**Key Discussions**:
- Hello World scope: single dummy `hello_world` tool — NOT a real Planka tool stub
- GitHub repo: public
- Package manager: npm
- Initial commit: include existing `docs/` folder
- npm scope: `@adflz` (user's npmjs.com account: https://www.npmjs.com/~adflz)

**Research Findings**:
- MCP SDK uses `McpServer` class from `@modelcontextprotocol/sdk/server/mcp.js`
- stdio transport via `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`
- `tsup` for building with shebang banner (`#!/usr/bin/env node`)
- `package.json` needs: `type: "module"`, `bin` field pointing to `dist/index.js`, `files: ["dist"]`, `publishConfig: { access: "public" }`
- tsconfig: `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`
- Real examples followed: `@modelcontextprotocol/server-filesystem`, `@modelcontextprotocol/server-everything`

### Metis Review
**Identified Gaps** (addressed):
- Secret leakage risk: `.gitignore` MUST be created before any `git add` — addressed via preflight + ordering
- Preflight checks needed for `gh` auth and npm auth — added as Task 1
- README.md and LICENSE omitted — defaulted to including a minimal README (required for npm) and MIT LICENSE (standard for public packages)
- `package-lock.json` should be committed — included in commit strategy
- Atomic commit strategy recommended — adopted 2-commit approach
- `docs/` should be in git but NOT in npm tarball — handled via `files: ["dist"]` in package.json

---

## Work Objectives

### Core Objective
Bootstrap the planka-pms-mcp project from docs-only state to a build-ready, npm-publishable MCP Hello World server hosted on GitHub.

### Concrete Deliverables
- `.gitignore` — Node.js/TypeScript/macOS patterns, protects `.env`
- `package.json` — `@adflz/planka-pms-mcp`, ESM, bin, publishConfig
- `package-lock.json` — committed for reproducible installs
- `tsconfig.json` — ES2022/NodeNext strict config
- `tsup.config.ts` — ESM build with shebang banner
- `src/index.ts` — McpServer + StdioServerTransport + `hello_world` tool
- `README.md` — minimal project description
- `LICENSE` — MIT
- GitHub remote at `github.com/adaofeliz/planka-pms-mcp` (public)
- All code pushed to `main` branch

### Definition of Done
- [ ] `npm run build` succeeds, `dist/index.js` exists with shebang
- [ ] `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}' | node dist/index.js` returns valid MCP response
- [ ] `npm pack --json` excludes `.env`, `node_modules`, `docs/`, includes `dist/`
- [ ] `git check-ignore .env` confirms .env is ignored
- [ ] `gh repo view adaofeliz/planka-pms-mcp --json name,visibility` shows `PUBLIC`
- [ ] `git log --oneline` shows clean commit history

### Must Have
- `.gitignore` with `.env` protection
- `package.json` with correct `name`, `type`, `bin`, `files`, `publishConfig`
- Working MCP server with exactly one `hello_world` tool
- stdio transport only
- TypeScript ESM build pipeline
- Public GitHub repo with code pushed
- `docs/` folder in git history

### Must NOT Have (Guardrails)
- **No real Planka API calls or client code** — this is Hello World only
- **No SSE/HTTP transport** — stdio only for MVP
- **No YAML config system, config loader, or dynamic tool generation**
- **No multiple tools, resources, or prompts** — exactly one `hello_world` tool
- **No CI/CD pipelines, GitHub Actions, or release automation**
- **No npm publish** — configured for publishing, not actually published
- **No linting, formatting, or pre-commit hooks** — those come later
- **No modification of existing `docs/` files**
- **No `.env` committed to git** — must be protected by `.gitignore`

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (greenfield)
- **Automated tests**: NO — Hello World boilerplate; testing comes in next phase
- **Framework**: None for now
- **Verification method**: Agent-executed QA scenarios using bash commands

### QA Policy
Every task includes agent-executed QA scenarios verifying the deliverable.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Build verification**: Use Bash — `npm run build`, check output files
- **MCP server verification**: Use Bash — pipe JSON-RPC to stdio, validate response
- **Package verification**: Use Bash — `npm pack`, inspect tarball contents
- **Git verification**: Use Bash — `git check-ignore`, `git status`, `git log`
- **GitHub verification**: Use Bash — `gh repo view`, `git remote -v`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — preflight + foundation):
├── Task 1: Preflight checks (gh auth, npm auth, repo/package availability) [quick]
├── Task 2: Create .gitignore [quick]
└── Task 3: Create README.md + LICENSE [quick]

Wave 2 (After Wave 1 — scaffold + implementation, then commit + remote):
├── Task 4: Package scaffold (package.json, tsconfig, tsup, npm install) [quick]
├── Task 5: MCP Hello World server (src/index.ts) [quick]
├── Task 6: Build, verify, commit, create GitHub repo, and push [deep]

Wave FINAL (After ALL tasks — verification):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 (Preflight) | — | 4, 5, 6 | 1 |
| 2 (.gitignore) | — | 6 | 1 |
| 3 (README+LICENSE) | — | 6 | 1 |
| 4 (Package scaffold) | 1 | 5, 6 | 2 |
| 5 (MCP server) | 4 | 6 | 2 |
| 6 (Build+Commit+Push) | 2, 3, 4, 5 | F1-F4 | 2 |
| F1-F4 (Verification) | 6 | — | FINAL |

### Agent Dispatch Summary

- **Wave 1**: **3 tasks** — T1 → `quick`, T2 → `quick`, T3 → `quick`
- **Wave 2**: **3 tasks** — T4 → `quick`, T5 → `quick`, T6 → `deep`
- **FINAL**: **4 tasks** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Preflight Checks

  **What to do**:
  - Verify `gh` CLI is authenticated: `gh auth status`
  - Verify npm is authenticated: `npm whoami` — must return a valid user
  - Check that GitHub repo `adaofeliz/planka-pms-mcp` does NOT already exist as a remote repo: `gh repo view adaofeliz/planka-pms-mcp 2>&1` should return "not found" or similar error
  - Check that npm package `@adflz/planka-pms-mcp` is available: `npm view @adflz/planka-pms-mcp 2>&1` should return 404/not found
  - If ANY check fails: STOP and report the issue. Do NOT proceed with other tasks.

  **Must NOT do**:
  - Do not create any files
  - Do not modify any state
  - Do not install anything

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple bash commands, no code writing needed
  - **Skills**: []
    - No skills needed — pure bash verification

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4, 5, 6
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - None — these are standard CLI verification commands

  **External References**:
  - `gh auth status` — GitHub CLI auth check
  - `npm whoami` — npm registry auth check

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All preflight checks pass
    Tool: Bash
    Preconditions: Developer machine with gh and npm installed
    Steps:
      1. Run `gh auth status` — expect exit code 0, output contains "Logged in"
      2. Run `npm whoami` — expect exit code 0, output is a valid npm username
      3. Run `gh repo view adaofeliz/planka-pms-mcp 2>&1` — expect non-zero exit or "Could not resolve" in output (repo doesn't exist yet)
      4. Run `npm view @adflz/planka-pms-mcp 2>&1` — expect non-zero exit or "404" in output (package not published yet)
    Expected Result: All 4 checks pass, confirming external services are ready
    Failure Indicators: Any command returns unexpected result (e.g., repo already exists, npm auth fails)
    Evidence: .sisyphus/evidence/task-1-preflight-checks.txt

  Scenario: Preflight check fails gracefully
    Tool: Bash
    Preconditions: One or more external services unavailable
    Steps:
      1. If any check fails, capture the error output
      2. Report which specific check failed and why
      3. Do NOT proceed to subsequent tasks
    Expected Result: Clear error message identifying the failing check
    Evidence: .sisyphus/evidence/task-1-preflight-failure.txt
  ```

  **Commit**: NO

- [x] 2. Create .gitignore

  **What to do**:
  - Create `.gitignore` at project root with patterns for:
    - Node.js: `node_modules/`, `npm-debug.log*`, `.npm/`
    - TypeScript: `dist/`, `build/`, `*.tsbuildinfo`
    - Environment/secrets: `.env`, `.env.local`, `.env.*.local` (but NOT `.env.example`)
    - macOS: `.DS_Store`, `._*`, `.Spotlight-V100`, `.Trashes`
    - IDE: `.vscode/` (with exceptions for settings.json, tasks.json, launch.json), `.idea/`, `*.swp`, `*.swo`
    - Logs: `*.log`
  - Immediately verify: `git check-ignore .env` must return `.env`
  - CRITICAL: This file MUST exist before any `git add` operations in later tasks

  **Must NOT do**:
  - Do not ignore `.env.example` — it must remain tracked
  - Do not ignore `docs/` — it must remain tracked
  - Do not add overly complex patterns — keep it standard

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file creation with well-known patterns
  - **Skills**: []
    - No skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 6
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - Librarian research findings provided standard Node.js/TypeScript/macOS .gitignore patterns

  **External References**:
  - GitHub's official Node.gitignore: https://github.com/github/gitignore/blob/main/Node.gitignore

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: .gitignore protects secrets and ignores build artifacts
    Tool: Bash
    Preconditions: .gitignore file created at project root
    Steps:
      1. Run `git check-ignore .env` — expect output: `.env`
      2. Run `git check-ignore .env.local` — expect output: `.env.local`
      3. Run `git check-ignore node_modules/foo` — expect output: `node_modules/foo`
      4. Run `git check-ignore dist/index.js` — expect output: `dist/index.js`
      5. Run `git check-ignore .DS_Store` — expect output: `.DS_Store`
      6. Run `git check-ignore .env.example` — expect NO output (exit code 1, NOT ignored)
      7. Run `git check-ignore docs/04-architecture.md` — expect NO output (exit code 1, NOT ignored)
    Expected Result: Secrets and build artifacts are ignored; .env.example and docs are tracked
    Failure Indicators: .env not ignored, or .env.example/docs accidentally ignored
    Evidence: .sisyphus/evidence/task-2-gitignore-check.txt
  ```

  **Commit**: YES (groups with commit 1 — Task 6 handles the actual commit)

- [x] 3. Create README.md and LICENSE

  **What to do**:
  - Create `README.md` at project root with:
    - Project name: `@adflz/planka-pms-mcp`
    - One-line description: "MCP server for Planka project management"
    - Installation section: `npx -y @adflz/planka-pms-mcp`
    - Configuration section: mention `PLANKA_BASE_URL` and `PLANKA_API_KEY` env vars
    - License: MIT
    - Keep it minimal — this will be expanded later
  - Create `LICENSE` at project root with MIT license text, year 2026

  **Must NOT do**:
  - Do not write extensive documentation — keep README under 50 lines
  - Do not duplicate content from `docs/` folder
  - Do not include badges, CI status, or contributor guidelines

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Two small files with standard content
  - **Skills**: []
    - No skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 6
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `docs/04-architecture.md:65` — Server name: `planka-pms`, version: `1.0.0`
  - `.env.example` — Environment variable names for README config section

  **External References**:
  - MIT License text: https://opensource.org/licenses/MIT

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: README and LICENSE exist with correct content
    Tool: Bash
    Preconditions: Files created at project root
    Steps:
      1. Run `test -f README.md && echo "EXISTS"` — expect "EXISTS"
      2. Run `test -f LICENSE && echo "EXISTS"` — expect "EXISTS"
      3. Run `grep -q "@adflz/planka-pms-mcp" README.md && echo "FOUND"` — expect "FOUND"
      4. Run `grep -q "npx -y @adflz/planka-pms-mcp" README.md && echo "FOUND"` — expect "FOUND"
      5. Run `grep -q "MIT" LICENSE && echo "FOUND"` — expect "FOUND"
      6. Run `wc -l < README.md` — expect less than 60 lines
    Expected Result: Both files exist with correct project name and license
    Failure Indicators: Missing files, wrong package name, or missing install command
    Evidence: .sisyphus/evidence/task-3-readme-license.txt
  ```

  **Commit**: YES (groups with commit 1 — Task 6 handles the actual commit)

- [x] 4. Package Scaffold (package.json, tsconfig, tsup, npm install)

  **What to do**:
  - Create `package.json` with:
    ```json
    {
      "name": "@adflz/planka-pms-mcp",
      "version": "0.1.0",
      "description": "MCP server for Planka project management",
      "type": "module",
      "bin": {
        "planka-pms-mcp": "./dist/index.js"
      },
      "files": ["dist"],
      "scripts": {
        "build": "tsup",
        "dev": "tsup --watch"
      },
      "publishConfig": {
        "access": "public"
      },
      "keywords": ["mcp", "planka", "project-management", "ai"],
      "author": "",
      "license": "MIT",
      "engines": {
        "node": ">=18.0.0"
      },
      "dependencies": {
        "@modelcontextprotocol/sdk": "latest",
        "zod": "latest"
      },
      "devDependencies": {
        "tsup": "latest",
        "typescript": "latest",
        "@types/node": "latest"
      }
    }
    ```
    Note: Use actual latest stable versions at time of install, not literal "latest".
  - Create `tsconfig.json`:
    ```json
    {
      "compilerOptions": {
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "outDir": "./dist",
        "declaration": true,
        "sourceMap": true
      },
      "include": ["src"]
    }
    ```
  - Create `tsup.config.ts`:
    ```typescript
    import { defineConfig } from "tsup";
    export default defineConfig({
      entry: ["src/index.ts"],
      format: ["esm"],
      outDir: "dist",
      clean: true,
      minify: false,
      sourcemap: true,
      banner: { js: "#!/usr/bin/env node" },
    });
    ```
  - Run `npm install` to generate `node_modules/` and `package-lock.json`
  - Verify `node_modules/` exists and `package-lock.json` was created

  **Must NOT do**:
  - Do not add dependencies beyond `@modelcontextprotocol/sdk` and `zod`
  - Do not add test frameworks yet
  - Do not add linting or formatting tools
  - Do not add any scripts beyond `build` and `dev`
  - Do not configure SSE or HTTP transport dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: File creation + npm install, well-defined outputs
  - **Skills**: []
    - No skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 1 passing)
  - **Parallel Group**: Wave 2 (sequential within wave: 4 → 5 → 6)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1 (preflight must pass)

  **References**:

  **Pattern References**:
  - `docs/04-architecture.md:606-613` — Technology stack table (Node.js, TypeScript, MCP SDK, Zod)
  - `docs/04-architecture.md:59-69` — Pseudocode showing McpServer initialization pattern
  - Librarian research: package.json structure for npx-invocable MCP servers

  **API/Type References**:
  - `@modelcontextprotocol/sdk` — MCP TypeScript SDK
  - `zod` — Schema validation (required by MCP SDK for tool schemas)
  - `tsup` — Build tool for ESM output with shebang

  **External References**:
  - npm scoped packages: https://docs.npmjs.com/creating-and-publishing-scoped-public-packages
  - tsup configuration: https://tsup.egoist.dev

  **WHY Each Reference Matters**:
  - `docs/04-architecture.md:606-613` — Confirms the exact tech stack decisions (Node.js runtime, TypeScript, MCP SDK, Zod, undici for HTTP)
  - Librarian findings — Confirmed that `bin` field + `files: ["dist"]` + `publishConfig.access: "public"` is the standard pattern for npx-invocable MCP servers

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Package scaffold is valid and installable
    Tool: Bash
    Preconditions: package.json, tsconfig.json, tsup.config.ts created
    Steps:
      1. Run `node -e "const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log(p.name)"` — expect `@adflz/planka-pms-mcp`
      2. Run `node -e "const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log(p.type)"` — expect `module`
      3. Run `node -e "const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log(p.bin['planka-pms-mcp'])"` — expect `./dist/index.js`
      4. Run `node -e "const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log(p.publishConfig.access)"` — expect `public`
      5. Run `test -f package-lock.json && echo "EXISTS"` — expect "EXISTS"
      6. Run `test -d node_modules && echo "EXISTS"` — expect "EXISTS"
      7. Run `test -f tsconfig.json && echo "EXISTS"` — expect "EXISTS"
      8. Run `test -f tsup.config.ts && echo "EXISTS"` — expect "EXISTS"
    Expected Result: All package metadata correct, dependencies installed
    Failure Indicators: Wrong package name, missing type:module, missing bin field, npm install failure
    Evidence: .sisyphus/evidence/task-4-package-scaffold.txt
  ```

  **Commit**: YES (groups with commit 1 — Task 6 handles the actual commit)

- [x] 5. MCP Hello World Server (src/index.ts)

  **What to do**:
  - Create `src/` directory
  - Create `src/index.ts` with:
    - Import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
    - Import `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`
    - Import `z` from `zod`
    - Create a new `McpServer` instance with name `"planka-pms"` and version from package.json or `"0.1.0"`
    - Register exactly ONE tool named `"hello_world"` with:
      - Description: `"A simple hello world tool to verify the MCP server is working"`
      - Schema: `{ name: z.string().optional().describe("Name to greet") }`
      - Handler: returns `{ content: [{ type: "text", text: "Hello, {name}! The Planka PMS MCP server is running." }] }` where `{name}` defaults to `"World"` if not provided
    - Create `StdioServerTransport` and connect the server
    - Add top-level `await server.connect(transport)` (ESM supports top-level await)
  - Build the project: `npm run build`
  - Verify `dist/index.js` exists and starts with `#!/usr/bin/env node`

  **Must NOT do**:
  - Do not register more than one tool
  - Do not import or reference any Planka APIs
  - Do not add any configuration loading
  - Do not add environment variable reading
  - Do not add error handling beyond what the SDK provides by default
  - Do not add logging or console output (stdio transport uses stdout for MCP protocol)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file creation with clear template from research
  - **Skills**: []
    - No skills needed — pattern is well-documented from librarian research

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential: 4 → 5 → 6)
  - **Blocks**: Task 6
  - **Blocked By**: Task 4 (needs dependencies installed)

  **References**:

  **Pattern References**:
  - `docs/04-architecture.md:59-69` — McpServer initialization pseudocode: `new McpServer({ name: "planka-pms", version: "1.0.0" })`, `server.tool(...)`, transport connection
  - `docs/04-architecture.md:50-58` — MCP Server component description: transport (stdio), tool registration, request routing
  - Librarian research: Complete working example of McpServer + StdioServerTransport + tool registration

  **API/Type References**:
  - `@modelcontextprotocol/sdk/server/mcp.js` → `McpServer` class
  - `@modelcontextprotocol/sdk/server/stdio.js` → `StdioServerTransport` class
  - `zod` → `z.string()`, `z.object()` for tool parameter schemas

  **External References**:
  - MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
  - McpServer API reference from librarian research

  **WHY Each Reference Matters**:
  - `docs/04-architecture.md:59-69` — Shows the exact pattern: create server, register tools with `server.tool()`, connect transport. The Hello World should mirror this structure so the real implementation can replace the dummy tool later.
  - Librarian research — Provides the exact import paths (`/server/mcp.js`, `/server/stdio.js`) which differ from typical npm import patterns

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: MCP server builds and responds to initialize
    Tool: Bash
    Preconditions: src/index.ts created, npm run build succeeds
    Steps:
      1. Run `npm run build` — expect exit code 0
      2. Run `test -f dist/index.js && echo "EXISTS"` — expect "EXISTS"
      3. Run `head -1 dist/index.js` — expect `#!/usr/bin/env node`
      4. Run `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}' | timeout 5 node dist/index.js 2>/dev/null | head -1 | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['result']['serverInfo']['name']=='planka-pms', f'Wrong name: {d}'; print('PASS')"` — expect "PASS"
    Expected Result: Server builds, outputs shebang, and responds to MCP initialize with correct server name
    Failure Indicators: Build fails, missing shebang, server hangs or returns invalid JSON-RPC
    Evidence: .sisyphus/evidence/task-5-mcp-server-build.txt

  Scenario: hello_world tool is registered and callable
    Tool: Bash
    Preconditions: MCP server built successfully
    Steps:
      1. Send initialize request, then send `{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}` to the server
      2. Parse the response and verify exactly one tool exists with name "hello_world"
      3. Send `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"hello_world","arguments":{"name":"Planka"}}}` to the server
      4. Parse the response and verify content contains "Hello, Planka!"
    Expected Result: Tool is listed and returns correct greeting
    Failure Indicators: Tool not found, wrong tool name, incorrect response content
    Evidence: .sisyphus/evidence/task-5-hello-world-tool.txt

  Scenario: npm pack produces correct tarball
    Tool: Bash
    Preconditions: Build completed successfully
    Steps:
      1. Run `npm pack --dry-run 2>&1` — inspect listed files
      2. Verify `dist/index.js` is included in the tarball
      3. Verify `.env` is NOT included
      4. Verify `node_modules/` is NOT included
      5. Verify `docs/` is NOT included (only `dist/` should be in `files`)
    Expected Result: Tarball contains only dist/ files, README, LICENSE, package.json
    Failure Indicators: .env or docs/ or node_modules/ in tarball
    Evidence: .sisyphus/evidence/task-5-npm-pack.txt
  ```

  **Commit**: YES (commit 2: `feat: add hello_world MCP server with stdio transport`)

- [x] 6. Create GitHub Repo, Commit All, and Push

  **What to do**:
  - Stage and create commit 1 with ALL scaffold files:
    - `.gitignore`, `README.md`, `LICENSE`, `.env.example`
    - `docs/` (all 5 existing documentation files)
    - `package.json`, `package-lock.json`, `tsconfig.json`, `tsup.config.ts`
    - Message: `chore: add repo hygiene, docs, and TypeScript MCP package scaffold`
  - BEFORE committing: run `git status` and verify `.env` is NOT staged, `node_modules/` is NOT staged, `dist/` is NOT staged
  - Stage and create commit 2 with server code:
    - `src/index.ts`
    - Message: `feat: add hello_world MCP server with stdio transport`
    - Pre-commit: `npm run build && test -f dist/index.js`
  - Create GitHub repo: `gh repo create adaofeliz/planka-pms-mcp --public --source=. --remote=origin --push`
    - This creates the repo, sets origin, and pushes in one command
  - Verify: `gh repo view adaofeliz/planka-pms-mcp --json name,visibility`

  **Must NOT do**:
  - Do NOT stage `.env` — verify it's ignored before any `git add`
  - Do NOT stage `node_modules/` or `dist/`
  - Do NOT force push
  - Do NOT create a private repo
  - Do NOT modify any existing `docs/` files

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Multi-step git + GitHub operations with critical ordering and verification at each step
  - **Skills**: [`git-master`]
    - `git-master`: Needed for atomic commit strategy, staging verification, and safe push workflow

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential: must be last in wave)
  - **Blocks**: F1-F4 (verification wave)
  - **Blocked By**: Tasks 2, 3, 4, 5 (all files must exist)

  **References**:

  **Pattern References**:
  - `.env` — Contains real Planka credentials, MUST be verified as ignored before staging
  - `.env.example` — Safe to commit, contains placeholder values only
  - `docs/` — All 5 files: `01-planka-api-reference.md`, `02-board-structure-analysis.md`, `03-mcp-philosophy.md`, `04-architecture.md`, `05-tool-catalog.md`

  **External References**:
  - `gh repo create` docs: https://cli.github.com/manual/gh_repo_create

  **WHY Each Reference Matters**:
  - `.env` reference — The file contains real API credentials (`PLANKA_BASE_URL`, `PLANKA_API_KEY`). Accidentally staging this would leak secrets to a public repo. This is the highest-risk operation in the entire plan.
  - `docs/` reference — User explicitly requested including docs in the initial commit

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Commits are clean and secrets are protected
    Tool: Bash
    Preconditions: All files from tasks 2-5 created
    Steps:
      1. Run `git check-ignore .env` — expect `.env` output
      2. Run `git status --short` — verify `.env` does NOT appear as staged
      3. Run `git log --oneline` — expect exactly 2 commits
      4. Run `git log --oneline | head -1` — expect contains "hello_world" or "MCP server"
      5. Run `git log --oneline | tail -1` — expect contains "scaffold" or "hygiene"
      6. Run `git show --stat HEAD~1` — verify docs/ files present, .env absent
      7. Run `git show --stat HEAD` — verify src/index.ts present
    Expected Result: 2 clean atomic commits, no secrets in history
    Failure Indicators: .env in commit, missing docs, wrong commit order
    Evidence: .sisyphus/evidence/task-6-git-commits.txt

  Scenario: GitHub repo created and code pushed
    Tool: Bash
    Preconditions: Commits created locally
    Steps:
      1. Run `gh repo view adaofeliz/planka-pms-mcp --json name,visibility` — expect `{"name":"planka-pms-mcp","visibility":"PUBLIC"}`
      2. Run `git remote -v` — expect origin pointing to github.com/adaofeliz/planka-pms-mcp
      3. Run `git status` — expect "Your branch is up to date with 'origin/main'" or similar
    Expected Result: Public repo exists, origin configured, code pushed
    Failure Indicators: Repo not found, wrong visibility, remote not configured
    Evidence: .sisyphus/evidence/task-6-github-repo.txt

  Scenario: GitHub repo creation fails (error handling)
    Tool: Bash
    Preconditions: gh repo create returns error
    Steps:
      1. If `gh repo create` fails, capture error output
      2. Check if repo already exists: `gh repo view adaofeliz/planka-pms-mcp` — if it does, add as remote instead
      3. If auth fails, report the issue and halt
    Expected Result: Graceful handling of creation failure
    Evidence: .sisyphus/evidence/task-6-github-error.txt
  ```

  **Commit**: YES (this task IS the commit task)
  - Commit 1: `chore: add repo hygiene, docs, and TypeScript MCP package scaffold`
    - Files: `.gitignore`, `README.md`, `LICENSE`, `.env.example`, `docs/*`, `package.json`, `package-lock.json`, `tsconfig.json`, `tsup.config.ts`
    - Pre-commit: `git check-ignore .env`
  - Commit 2: `feat: add hello_world MCP server with stdio transport`
    - Files: `src/index.ts`
    - Pre-commit: `npm run build && test -f dist/index.js`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
>
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `npm run build`. Review all files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Build the project. Pipe MCP initialize + tools/list + tools/call to the server via stdin. Verify responses. Run `npm pack` and inspect tarball. Verify `gh repo view`. Save evidence to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual files created. Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT Have" compliance. Flag any real Planka client code, SSE transport, YAML config, multiple tools, CI pipelines, or other scope creep.
  Output: `Tasks [N/N compliant] | Scope Creep [CLEAN/N issues] | VERDICT`

---

## Commit Strategy

| Commit | Message | Files | Pre-commit check |
|--------|---------|-------|-----------------|
| 1 | `chore: add repo hygiene, docs, and TypeScript MCP package scaffold` | `.gitignore`, `README.md`, `LICENSE`, `docs/`, `package.json`, `package-lock.json`, `tsconfig.json`, `tsup.config.ts`, `.env.example` | `git check-ignore .env` returns `.env` |
| 2 | `feat: add hello_world MCP server with stdio transport` | `src/index.ts` | `npm run build && test -f dist/index.js` |

After both commits: create GitHub remote and push.

---

## Success Criteria

### Verification Commands
```bash
npm run build                    # Expected: exits 0, dist/index.js created
test -f dist/index.js            # Expected: file exists
head -1 dist/index.js            # Expected: #!/usr/bin/env node
git check-ignore .env            # Expected: .env
npm pack --json | jq '.[0].files[].path'  # Expected: includes dist/index.js, excludes .env
gh repo view adaofeliz/planka-pms-mcp --json visibility  # Expected: {"visibility":"PUBLIC"}
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}' | node dist/index.js  # Expected: valid JSON-RPC response
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] Build succeeds
- [ ] MCP server responds to initialize
- [ ] npm pack produces valid tarball
- [ ] GitHub repo is public and code is pushed
- [ ] `.env` is NOT in git history
