import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";

import { initializeServices, resolvePort, resolveUseHttp } from "./bootstrap.js";
import { registerCoreTools, registerWorkflowTools } from "./tools/generator.js";
import { CORE_TOOL_DEFINITIONS } from "./tools/core/index.js";

const SERVER_NAME = "planka-pms";
const SERVER_VERSION = "0.1.0";
const useHttp = resolveUseHttp();
const port = resolvePort();

function log(message: string): void {
  process.stderr.write(`[${SERVER_NAME}] ${message}\n`);
}

let services: Awaited<ReturnType<typeof initializeServices>>;

function createAndRegisterServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerCoreTools(
    server,
    CORE_TOOL_DEFINITIONS,
    services.config,
    services.client,
    services.cache,
    services.logger,
  );
  registerWorkflowTools(
    server,
    services.config,
    services.client,
    services.cache,
    services.logger,
  );
  return server;
}

async function startHttpServer() {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer: HttpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          server: SERVER_NAME,
          version: SERVER_VERSION,
          activeSessions: transports.size,
        }),
      );
      return;
    }

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

    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString());
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON in request body" }));
      return;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res, body);
      return;
    }

    const isInit = Array.isArray(body)
      ? body.some((m: { method?: string }) => m.method === "initialize")
      : (body as { method?: string }).method === "initialize";

    if (!isInit) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "First request must be initialize" }));
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    const server = createAndRegisterServer();

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
    log(`Health check: http://localhost:${port}/health`);
    log(`Connect with: npx @modelcontextprotocol/inspector --cli http://localhost:${port}/mcp`);
  });

  return { httpServer, transports };
}

async function startStdioServer() {
  log("Starting in stdio mode");
  const server = createAndRegisterServer();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("Server connected via stdio");

  return { server, transport };
}

async function main(): Promise<void> {
  try {
    services = await initializeServices(SERVER_NAME);
  } catch (error) {
    log(`Startup initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  if (useHttp) {
    const { httpServer, transports } = await startHttpServer();

    const shutdown = async (): Promise<void> => {
      log("Shutting down HTTP server...");
      for (const [id, transport] of transports) {
        await transport.close();
        transports.delete(id);
      }
      httpServer.close(() => {
        log("HTTP server closed");
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    return;
  }

  const { server } = await startStdioServer();

  const shutdown = async (): Promise<void> => {
    log("Shutting down stdio server...");
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  log(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
