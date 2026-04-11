import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const SERVER_NAME = "planka-pms";
const SERVER_VERSION = "0.1.0";

const args = process.argv.slice(2);
const useHttp = args.includes("--http");
const portFlag = args.find((a) => a.startsWith("--port="));
const port = portFlag ? Number(portFlag.split("=")[1]) : 3000;

function log(message: string) {
  process.stderr.write(`[${SERVER_NAME}] ${message}\n`);
}

function registerTools(server: McpServer) {
  server.registerTool(
    "hello_world",
    {
      description:
        "A simple hello world tool to verify the MCP server is working",
      inputSchema: {
        name: z.string().optional().describe("Name to greet"),
      },
    },
    async ({ name }) => {
      log(`tool/call hello_world ${JSON.stringify({ name })}`);
      const result = {
        content: [
          {
            type: "text" as const,
            text: `Hello, ${name ?? "World"}! The Planka PMS MCP server is running.`,
          },
        ],
      };
      log(`tool/result hello_world -> ${result.content[0].text}`);
      return result;
    },
  );
}

async function startHttpServer() {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    if (url.pathname !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found. Use POST /mcp" }));
      return;
    }

    if (req.method === "GET") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId || !transports.has(sessionId)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid or missing session ID" }));
        return;
      }
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }

    if (req.method === "DELETE") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.close();
        transports.delete(sessionId);
        log(`Session ${sessionId} closed`);
      }
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString());

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res, body);
      return;
    }

    const isInit = Array.isArray(body)
      ? body.some((m: { method?: string }) => m.method === "initialize")
      : body.method === "initialize";

    if (!isInit) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "First request must be initialize" }));
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    const server = new McpServer({
      name: SERVER_NAME,
      version: SERVER_VERSION,
    });
    registerTools(server);

    await server.connect(transport);
    await transport.handleRequest(req, res, body);

    const newSessionId = transport.sessionId!;
    transports.set(newSessionId, transport);
    log(`New session: ${newSessionId}`);

    transport.onclose = () => {
      transports.delete(newSessionId);
      log(`Session ${newSessionId} disconnected`);
    };
  });

  httpServer.listen(port, () => {
    log(`HTTP server listening on http://localhost:${port}/mcp`);
    log(`Connect with: npx @modelcontextprotocol/inspector --cli http://localhost:${port}/mcp`);
  });
}

async function startStdioServer() {
  log("Starting in stdio mode");
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });
  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("Server connected via stdio");
}

if (useHttp) {
  startHttpServer();
} else {
  startStdioServer();
}
