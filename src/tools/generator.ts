import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BoardSkeletonCache, normalizeBoardSkeleton } from "../client/cache.js";
import type { PlankaConfig } from "../config/types.js";
import { NameResolver } from "../client/resolver.js";
import type { ToolContext } from "./core/shared.js";

export interface CoreToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    idempotentHint: boolean;
    destructiveHint: boolean;
  };
  handler: (
    ctx: ToolContext,
    input: Record<string, unknown>,
  ) => Promise<{ content: Array<{ type: "text"; text: string }> }>;
}

export async function buildToolContext(
  config: PlankaConfig,
  client: ToolContext["client"],
  cache: BoardSkeletonCache,
  logger: ToolContext["logger"],
): Promise<ToolContext> {
  const boardId = config.connection.board_id;
  const cached = cache.get(boardId);
  const skeleton = cached ?? normalizeBoardSkeleton(await client.getBoard(boardId));
  if (!cached) {
    cache.set(boardId, skeleton);
  }

  const resolver = new NameResolver(skeleton, config);
  return { config, client, cache, resolver, logger };
}

export function registerCoreTools(
  server: McpServer,
  tools: CoreToolDefinition[],
  config: PlankaConfig,
  client: ToolContext["client"],
  cache: BoardSkeletonCache,
  logger: ToolContext["logger"],
): void {
  const seen = new Set<string>();
  for (const tool of tools) {
    if (seen.has(tool.name)) {
      throw new Error(`Duplicate tool name: ${tool.name}`);
    }
    seen.add(tool.name);

    if (
      tool.annotations.readOnlyHint === undefined ||
      tool.annotations.idempotentHint === undefined ||
      tool.annotations.destructiveHint === undefined
    ) {
      throw new Error(`Tool ${tool.name} missing required annotations`);
    }
  }

  for (const tool of tools) {
    const handler = (async (params: Record<string, unknown>) => {
      const ctx = await buildToolContext(config, client, cache, logger);
      return tool.handler(ctx, params);
    }) as unknown as Parameters<McpServer["registerTool"]>[2];

    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema:
          tool.inputSchema as Parameters<McpServer["registerTool"]>[1]["inputSchema"],
        annotations: tool.annotations,
      },
      handler,
    );
  }
}
