import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { loadConfig } from "./config/loader.js";
import { createLogger } from "./utils/logger.js";
import { PlankaClient } from "./client/planka-client.js";
import { BoardSkeletonCache, normalizeBoardSkeleton } from "./client/cache.js";
import { NameResolver } from "./client/resolver.js";
import { boardOverviewTool, boardOverviewHandler } from "./tools/core/board-overview.js";
import type { ToolContext } from "./tools/core/shared.js";

const SERVER_NAME = "planka-pms";
const SERVER_VERSION = "0.1.0";

const configPath = (() => {
  const flag = process.argv.find((a) => a.startsWith("--config="));
  if (flag) return flag.split("=")[1];
  return process.env.PLANKA_CONFIG_PATH ?? "config/default.yaml";
})();

const config = loadConfig(configPath);
const logger = createLogger(SERVER_NAME);
const client = new PlankaClient({
  baseUrl: config.connection.base_url,
  apiKey: config.connection.api_key,
  logger,
});
const cache = new BoardSkeletonCache(config.cache.skeleton_ttl_seconds * 1000);

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
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
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

  server.registerTool(
    boardOverviewTool.name,
    {
      description: boardOverviewTool.description,
      inputSchema: boardOverviewTool.inputSchema,
      annotations: boardOverviewTool.annotations,
    },
    async (params) => {
      const cachedSkeleton = cache.get(config.connection.board_id);
      const skeleton = cachedSkeleton ?? normalizeBoardSkeleton(await client.getBoard(config.connection.board_id));
      if (!cachedSkeleton) {
        cache.set(config.connection.board_id, skeleton);
      }
      const resolver = new NameResolver(skeleton, config);

      const ctx: ToolContext = { config, client, cache, resolver, logger };
      return boardOverviewHandler(params as { board_id?: string }, ctx);
    },
  );

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
    log(`Health check: http://localhost:${port}/health`);
    log(`Connect with: npx @modelcontextprotocol/inspector --cli http://localhost:${port}/mcp`);
  });

  return { httpServer, transports };
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

  return { server, transport };
}

async function main() {
  if (useHttp) {
    const { httpServer, transports } = await startHttpServer();

    const shutdown = async () => {
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
  } else {
    const { server } = await startStdioServer();

    const shutdown = async () => {
      log("Shutting down stdio server...");
      await server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
}

main().catch((err) => {
  log(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
