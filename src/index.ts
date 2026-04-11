import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "planka-pms",
  version: "0.1.0",
});

server.registerTool(
  "hello_world",
  {
    description: "A simple hello world tool to verify the MCP server is working",
    inputSchema: {
      name: z.string().optional().describe("Name to greet"),
    },
  },
  async ({ name }) => ({
    content: [
      {
        type: "text",
        text: `Hello, ${name ?? "World"}! The Planka PMS MCP server is running.`,
      },
    ],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
