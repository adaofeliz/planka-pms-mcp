import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";

import type { ServiceContainer } from "./service-container.js";
import { CORE_TOOL_DEFINITIONS } from "./tools/core/index.js";
import { registerCoreTools, registerWorkflowTools } from "./tools/generator.js";

export interface HttpServerRuntime {
  httpServer: HttpServer;
  transports: Map<string, StreamableHTTPServerTransport>;
  close: () => Promise<void>;
}

export async function startHttpServer(options: {
  services: ServiceContainer;
  serverName: string;
  serverVersion: string;
  port: number;
}): Promise<HttpServerRuntime> {
  const { services, serverName, serverVersion, port } = options;
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const log = (message: string): void => {
    process.stderr.write(`[${serverName}] ${message}\n`);
  };

  const registerTools = (server: McpServer): void => {
    registerCoreTools(server, CORE_TOOL_DEFINITIONS, services.config, services.client, services.cache, services.logger);
    registerWorkflowTools(server, services.config, services.client, services.cache, services.logger);
  };

  const httpServer: HttpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          server: serverName,
          version: serverVersion,
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

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
    const server = new McpServer({ name: serverName, version: serverVersion });
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

  await new Promise<void>((resolve) => {
    httpServer.listen(port, () => {
      log(`HTTP server listening on http://localhost:${port}/mcp`);
      log(`Health check: http://localhost:${port}/health`);
      resolve();
    });
  });

  return {
    httpServer,
    transports,
    close: async () => {
      for (const [id, transport] of transports) {
        await transport.close();
        transports.delete(id);
      }
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    },
  };
}
