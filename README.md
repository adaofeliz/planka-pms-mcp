# @adaofeliz/planka-pms-mcp

GTD-inspired MCP server for Planka boards. It gives AI agents a workflow-aware productivity layer: inbox capture, triage, scheduling, focused execution, stopwatch/Pomodoro tracking, done/archive handling, and overdue recovery suggestions.

This is intentionally semantic (workflow tools + board rules), not a raw Planka CRUD wrapper.

## Prerequisites

- Node.js 18+
- npm
- A running Planka instance with API key
- A target board ID

## Setup

```bash
npm install
cp .env.example .env
```

Fill `.env` values:

- `PLANKA_BASE_URL`
- `PLANKA_API_KEY`
- `PLANKA_BOARD_ID`
- optional: `PLANKA_CONFIG_PATH` (defaults to `config/default.yaml`)

Build once:

```bash
npm run build
```

## Configuration

Main config is `config/default.yaml`.

- `connection`: Planka URL/key/board ID (via `${ENV_VAR}` interpolation)
- `board`: list names, transitions, WIP limits, sort rules, due-date windows
- `labels` / `custom_fields`: required triage metadata
- `tools.generate`: dynamic workflow tools (e.g. `triage_card`, `start_working`)
- `cache`: board skeleton TTL + optional startup preload

## Running

### MCP client configuration (npx)

Add to your MCP client config (Claude Desktop, Cursor, MCPHub, etc.):

```json
{
  "mcpServers": {
    "planka-pms-mcp": {
      "command": "npx",
      "args": ["-y", "@adflz/planka-pms-mcp@0.1.7"],
      "env": {
        "PLANKA_BASE_URL": "https://your-planka-instance.com",
        "PLANKA_API_KEY": "your-api-key",
        "PLANKA_BOARD_ID": "your-board-id"
      }
    }
  }
}
```

### stdio mode (default)

Use this for local development:

```bash
node dist/index.js
```

With MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

### Streamable HTTP mode

```bash
node dist/index.js --http
node dist/index.js --http --port=8080
```

Endpoints:

- MCP: `http://localhost:<port>/mcp`
- Health: `http://localhost:<port>/health`

## Available tools (18+ core)

### Read

- `board_overview`, `list_cards`, `get_card`, `search_cards`, `daily_summary`, `overdue_check`, `search_archive`

### Write

- `create_card`, `update_card`, `move_card`, `complete_card`, `block_card`, `archive_card`, `manage_checklist`, `add_comment`, `sort_list`

### Workflow (generated from config)

- `triage_card`, `schedule_for_today`, `start_working`, `park_as_noise`

### Time tracking

- `stopwatch`, `pomodoro`

## Generated workflow tools

`config/default.yaml` drives generation of higher-level tools that compose core operations and enforce board semantics. Typical flow:

`triage_card` → `schedule_for_today` → `start_working` → `complete_card` → `archive_card`

## Testing

- Mocked/full suite (default):

```bash
npm test
```

- Live smoke tests against a real Planka instance:

```bash
PLANKA_LIVE_TESTS=1 npm run test:live
```

Live tests are skipped unless `PLANKA_LIVE_TESTS=1` is set.

## License

MIT
