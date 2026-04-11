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

## Local Development

```bash
git clone https://github.com/adaofeliz/planka-pms-mcp.git
cd planka-pms-mcp
npm install
npm run build
```

The server supports two transport modes:

### stdio (default)

Used by MCP clients like Claude Code and Cursor. Test with the inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

### Streamable HTTP

Starts an HTTP server on `localhost:3000/mcp`. Useful for web-based clients and the inspector's HTTP mode:

```bash
node dist/index.js --http
```

Custom port:

```bash
node dist/index.js --http --port=8080
```

Test with the inspector over HTTP:

```bash
npx @modelcontextprotocol/inspector --cli http://localhost:3000/mcp
```

### Watch mode

For development with auto-rebuild on file changes:

```bash
npm run dev
```

Then in a separate terminal, run the inspector pointing to the built output.

## Documentation

See the [`docs/`](./docs/) folder for full architecture and tool catalog.

## License

MIT
