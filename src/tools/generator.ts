import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BoardSkeletonCache, normalizeBoardSkeleton } from "../client/cache.js";
import type { PlankaConfig } from "../config/types.js";
import { NameResolver } from "../client/resolver.js";
import type { ToolContext } from "./core/shared.js";
import type { GeneratedToolConfig } from "../config/types.js";
import { z } from "zod";
import { ValidationError } from "../utils/errors.js";
import { toolError, toolResult } from "./core/shared.js";
import { moveCardTool } from "./core/move-card.js";
import { updateCardTool } from "./core/update-card.js";
import { blockCardTool } from "./core/block-card.js";
import { archiveCardTool } from "./core/archive-card.js";
import { completeCardTool } from "./core/complete-card.js";

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

const COMPOSABLE_EXECUTORS: Record<string, CoreToolDefinition | null> = {
  move_card: moveCardTool as unknown as CoreToolDefinition,
  update_card: updateCardTool as unknown as CoreToolDefinition,
  block_card: blockCardTool as unknown as CoreToolDefinition,
  archive_card: archiveCardTool as unknown as CoreToolDefinition,
  complete_card: completeCardTool as unknown as CoreToolDefinition,
  start_stopwatch: null,
  add_comment: null,
  stopwatch: null,
};

const triageCardSchema = {
  card_id: z.string().min(1),
  target_list: z.string().min(1),
  domain_label: z.string().min(1),
  type_label: z.string().min(1),
  priority: z.number().int().min(1).max(5),
  duration_min: z.number().int().positive(),
  due_date: z.string().min(1).describe("ISO date"),
};

const simpleCardSchema = {
  card_id: z.string().min(1),
};

function zodObjectForTool(name: string): z.ZodObject<Record<string, z.ZodTypeAny>> {
  if (name === "triage_card") {
    return z.object(triageCardSchema);
  }

  return z.object(simpleCardSchema);
}

function inputSchemaForTool(name: string): Record<string, unknown> {
  if (name === "triage_card") {
    return triageCardSchema;
  }

  return simpleCardSchema;
}

function requireTool(toolName: string): CoreToolDefinition {
  const tool = COMPOSABLE_EXECUTORS[toolName];
  if (!tool) {
    throw new ValidationError(`Unsupported or inline-only executor: ${toolName}`);
  }

  return tool;
}

function validateRequiredParams(config: GeneratedToolConfig, input: Record<string, unknown>): void {
  const required = config.required_params ?? [];
  const missing = required.filter((key) => {
    const value = input[key];
    return value === undefined || value === null || value === "";
  });

  if (missing.length > 0) {
    throw new ValidationError(
      `${config.name} missing required params: ${missing.join(", ")}`,
      ["Provide all required triage metadata before moving out of INBOX"],
    );
  }
}

export function registerWorkflowTools(
  server: McpServer,
  config: PlankaConfig,
  client: ToolContext["client"],
  cache: BoardSkeletonCache,
  logger: ToolContext["logger"],
): void {
  for (const generated of config.tools.generate) {
    const inputSchema = inputSchemaForTool(generated.name);
    const schema = zodObjectForTool(generated.name);

    const handler = (async (params: Record<string, unknown>) => {
      try {
        const parsed = schema.parse(params) as Record<string, unknown>;
        const ctx = await buildToolContext(config, client, cache, logger);

        if (generated.name === "triage_card") {
          validateRequiredParams(generated, parsed);
          const cardId = String(parsed.card_id);
          await requireTool("move_card").handler(ctx, {
            card_id: cardId,
            target_list: String(parsed.target_list),
          });

          const domainLabelId = ctx.resolver.resolveLabelId(String(parsed.domain_label));
          const typeLabelId = ctx.resolver.resolveLabelId(String(parsed.type_label));
          await ctx.client.addCardLabel(cardId, domainLabelId);
          await ctx.client.addCardLabel(cardId, typeLabelId);

          const boardId = ctx.config.connection.board_id;
          const skeleton = ctx.cache.get(boardId) ?? normalizeBoardSkeleton(await ctx.client.getBoard(boardId));
          ctx.cache.set(boardId, skeleton);

          const fieldGroupId = skeleton.customFieldGroups[0]?.id;
          const priorityField = skeleton.customFields.find(
            (field) => field.name === ctx.config.custom_fields.priority.field_name,
          );
          const durationField = skeleton.customFields.find(
            (field) => field.name === ctx.config.custom_fields.duration.field_name,
          );

          if (!fieldGroupId || !priorityField || !durationField) {
            throw new ValidationError("Required custom field metadata is not available on this board");
          }

          await ctx.client.setCustomFieldValue(cardId, fieldGroupId, priorityField.id, String(parsed.priority));
          await ctx.client.setCustomFieldValue(cardId, fieldGroupId, durationField.id, String(parsed.duration_min));
          await ctx.client.updateCard(cardId, { dueDate: String(parsed.due_date) });

          return toolResult({ status: "triaged", card_id: cardId });
        }

        if (generated.name === "schedule_for_today") {
          const cardId = String(parsed.card_id);
          await requireTool("move_card").handler(ctx, {
            card_id: cardId,
            target_list: ctx.config.board.lists.today ?? "TODAY",
          });
          return toolResult({ status: "scheduled_for_today", card_id: cardId });
        }

        if (generated.name === "start_working") {
          const cardId = String(parsed.card_id);
          await requireTool("move_card").handler(ctx, {
            card_id: cardId,
            target_list: ctx.config.board.lists.active,
          });

          const card = await ctx.client.getCard(cardId);
          const stopwatchCapableClient = ctx.client as ToolContext["client"] & {
            startStopwatch?: (cardId: string, existingTotal: number) => Promise<unknown>;
          };
          if (!stopwatchCapableClient.startStopwatch) {
            throw new ValidationError("Client does not support stopwatch operations");
          }
          await stopwatchCapableClient.startStopwatch(cardId, card.item.stopwatch.total);

          return toolResult({
            status: "started_working",
            card_id: cardId,
            moved_to: ctx.config.board.lists.active,
            stopwatch_started: true,
          });
        }

        if (generated.name === "park_as_noise") {
          const cardId = String(parsed.card_id);
          const noiseListName = ctx.config.board.lists.noise ?? "NOISE";
          const noiseListId = ctx.resolver.resolveListId(noiseListName);
          const boardId = ctx.config.connection.board_id;
          const skeleton = ctx.cache.get(boardId) ?? normalizeBoardSkeleton(await ctx.client.getBoard(boardId));
          ctx.cache.set(boardId, skeleton);

          const currentNoiseCount = skeleton.cards.filter((card) => card.listId === noiseListId).length;
          const noiseLimit = ctx.config.board.wip_limits.noise;
          if (noiseLimit !== undefined && currentNoiseCount >= noiseLimit) {
            return toolError(`Cannot park in NOISE: WIP limit reached (${currentNoiseCount}/${noiseLimit})`);
          }

          await requireTool("move_card").handler(ctx, {
            card_id: cardId,
            target_list: noiseListName,
          });
          return toolResult({ status: "parked_as_noise", card_id: cardId });
        }

        throw new ValidationError(`Unsupported generated workflow tool: ${generated.name}`);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return toolError(`Invalid input for ${generated.name}: ${error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
        }
        const message = error instanceof Error ? error.message : String(error);
        return toolError(message);
      }
    }) as unknown as Parameters<McpServer["registerTool"]>[2];

    server.registerTool(
      generated.name,
      {
        description: generated.description,
        inputSchema: inputSchema as Parameters<McpServer["registerTool"]>[1]["inputSchema"],
        annotations: {
          readOnlyHint: false,
          idempotentHint: false,
          destructiveHint: false,
        },
      },
      handler,
    );
  }
}
