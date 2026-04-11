import { z } from "zod";

import type { ToolContext } from "./shared.js";
import { toolResult, toolError } from "./shared.js";
import { normalizeBoardSkeleton } from "../../client/cache.js";
import { shapeCard } from "../../shaper/response-shaper.js";

export const updateCardTool = {
  name: "update_card" as const,
  description: "Update card properties including name, description, due date, priority, duration, and labels.",
  inputSchema: {
    card_id: z.string().min(1),
    name: z.string().optional(),
    description: z.string().nullable().optional(),
    due_date: z.string().nullable().optional().describe("ISO date or null to clear"),
    priority: z.number().int().min(1).max(5).nullable().optional(),
    duration_min: z.number().int().positive().nullable().optional(),
    labels_add: z.array(z.string()).optional(),
    labels_remove: z.array(z.string()).optional(),
    is_due_completed: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
  async handler(
    ctx: ToolContext,
    input: {
      card_id: string;
      name?: string;
      description?: string | null;
      due_date?: string | null;
      priority?: number | null;
      duration_min?: number | null;
      labels_add?: string[];
      labels_remove?: string[];
      is_due_completed?: boolean;
    },
  ) {
    try {
      const boardId = ctx.config.connection.board_id;
      const skeleton = ctx.cache.get(boardId) ?? normalizeBoardSkeleton(await ctx.client.getBoard(boardId));
      ctx.cache.set(boardId, skeleton);

      const updateBody: Record<string, unknown> = {};
      if (input.name !== undefined) updateBody.name = input.name;
      if (input.description !== undefined) updateBody.description = input.description;
      if (input.due_date !== undefined) updateBody.dueDate = input.due_date;
      if (input.is_due_completed !== undefined) updateBody.isDueCompleted = input.is_due_completed;

      if (Object.keys(updateBody).length > 0) {
        await ctx.client.updateCard(input.card_id, updateBody);
      }

      if (input.labels_add?.length) {
        for (const labelName of input.labels_add) {
          const labelId = ctx.resolver.resolveLabelId(labelName);
          await ctx.client.addCardLabel(input.card_id, labelId);
        }
      }

      if (input.labels_remove?.length) {
        for (const labelName of input.labels_remove) {
          const labelId = ctx.resolver.resolveLabelId(labelName);
          await ctx.client.removeCardLabel(input.card_id, labelId);
        }
      }

      const priorityField = skeleton.customFields.find((f) => f.name === ctx.config.custom_fields.priority.field_name);
      if (priorityField) {
        if (input.priority === null) {
          await ctx.client.clearCustomFieldValue(input.card_id, priorityField.customFieldGroupId, priorityField.id);
        } else if (input.priority !== undefined) {
          await ctx.client.setCustomFieldValue(input.card_id, priorityField.customFieldGroupId, priorityField.id, String(input.priority));
        }
      }

      const durationField = skeleton.customFields.find((f) => f.name === ctx.config.custom_fields.duration.field_name);
      if (durationField) {
        if (input.duration_min === null) {
          await ctx.client.clearCustomFieldValue(input.card_id, durationField.customFieldGroupId, durationField.id);
        } else if (input.duration_min !== undefined) {
          await ctx.client.setCustomFieldValue(input.card_id, durationField.customFieldGroupId, durationField.id, String(input.duration_min));
        }
      }

      const response = await ctx.client.getCard(input.card_id);
      const card = response.item;

      const shaped = shapeCard({
        card,
        cardLabels: response.included.cardLabels ?? [],
        cardMemberships: response.included.cardMemberships ?? [],
        customFieldValues: response.included.customFieldValues ?? [],
        taskLists: response.included.taskLists ?? [],
        tasks: response.included.tasks ?? [],
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
      ctx.logger.error("update_card failed", { error: msg });
      return toolError(msg);
    }
  },
};
