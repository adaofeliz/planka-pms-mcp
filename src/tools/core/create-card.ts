import { z } from "zod";

import type { ToolContext } from "./shared.js";
import { toolResult, toolError } from "./shared.js";
import { normalizeBoardSkeleton } from "../../client/cache.js";
import { shapeCard } from "../../shaper/response-shaper.js";

export const createCardTool = {
  name: "create_card" as const,
  description: "Capture a new task to INBOX or a specified list. Card type is always 'project'.",
  inputSchema: {
    name: z.string().min(1).describe("Card title"),
    list_name: z.string().optional().describe("Target list name (defaults to INBOX)"),
    board_id: z.string().optional().describe("Board ID (uses config default)"),
    description: z.string().optional(),
    due_date: z.string().optional().describe("ISO date string"),
    labels: z.array(z.string()).optional().describe("Label names to apply"),
    priority: z.number().int().min(1).max(5).optional(),
    duration_min: z.number().int().positive().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
  async handler(
    ctx: ToolContext,
    input: {
      name: string;
      list_name?: string;
      board_id?: string;
      description?: string;
      due_date?: string;
      labels?: string[];
      priority?: number;
      duration_min?: number;
    },
  ) {
    try {
      const boardId = input.board_id ?? ctx.config.connection.board_id;
      const skeleton = ctx.cache.get(boardId) ?? normalizeBoardSkeleton(await ctx.client.getBoard(boardId));
      ctx.cache.set(boardId, skeleton);

      const targetListName = input.list_name ?? ctx.config.board.lists.inbox;
      const targetListId = ctx.resolver.resolveListId(targetListName);

      const response = await ctx.client.createCard(targetListId, {
        type: "project",
        name: input.name,
        description: input.description ?? null,
        dueDate: input.due_date ?? null,
      });
      const card = response.item;

      if (input.labels?.length) {
        for (const labelName of input.labels) {
          const labelId = ctx.resolver.resolveLabelId(labelName);
          await ctx.client.addCardLabel(card.id, labelId);
        }
      }

      if (input.priority !== undefined) {
        const priorityField = skeleton.customFields.find((f) => f.name === ctx.config.custom_fields.priority.field_name);
        if (priorityField) {
          await ctx.client.setCustomFieldValue(card.id, priorityField.customFieldGroupId, priorityField.id, String(input.priority));
        }
      }

      if (input.duration_min !== undefined) {
        const durationField = skeleton.customFields.find((f) => f.name === ctx.config.custom_fields.duration.field_name);
        if (durationField) {
          await ctx.client.setCustomFieldValue(card.id, durationField.customFieldGroupId, durationField.id, String(input.duration_min));
        }
      }

      const shaped = shapeCard({
        card,
        cardLabels: [],
        cardMemberships: [],
        customFieldValues: [],
        taskLists: [],
        tasks: [],
        ctx: {
          lists: skeleton.lists,
          labels: skeleton.labels,
          customFields: skeleton.customFields,
          customFieldGroups: skeleton.customFieldGroups,
          priorityFieldName: ctx.config.custom_fields.priority.field_name,
          durationFieldName: ctx.config.custom_fields.duration.field_name,
        },
        tier: "t1",
      });

      return toolResult(shaped);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logger.error("create_card failed", { error: msg });
      return toolError(msg);
    }
  },
};
