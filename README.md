# @adflz/planka-pms-mcp

MCP server for [Planka](https://planka.app) project management. Gives AI models structured, token-efficient access to a Planka task board.

## Installation

Use with any MCP-compatible client (Claude Code, Cursor, etc.):

```json
{
  "mcpServers": {
    "planka-pms": {
      "command": "npx",
      "args": ["-y", "@adflz/planka-pms-mcp"],
      "env": {
        "PLANKA_BASE_URL": "https://your-planka-domain",
        "PLANKA_API_KEY": "your-api-key"
      }
    }
  }
}
```

Or run directly:

```bash
npx -y @adflz/planka-pms-mcp
```

## Configuration

Set these environment variables before running:

| Variable | Description |
|----------|-------------|
| `PLANKA_BASE_URL` | Your Planka instance URL (e.g. `https://planka.example.com`) |
| `PLANKA_API_KEY` | Your Planka API key |

## Documentation

See the [`docs/`](./docs/) folder for full architecture and tool catalog.

## License

MIT
