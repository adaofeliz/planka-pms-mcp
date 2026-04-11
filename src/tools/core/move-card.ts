import { z } from "zod";

import type { ToolContext } from "./shared.js";
import { toolResult, toolError } from "./shared.js";
import { normalizeBoardSkeleton } from "../../client/cache.js";
import { TransitionError } from "../../utils/errors.js";
import { shapeCard } from "../../shaper/response-shaper.js";

export const moveCardTool = {
  name: "move_card" as const,
  description: "Move a card to a different list, validating configured transitions.",
  inputSchema: {
    card_id: z.string().min(1),
    target_list: z.string().min(1).describe("Target list name"),
    position: z.enum(["top", "bottom"]).optional().default("top"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
  async handler(ctx: ToolContext, input: { card_id: string; target_list: string; position?: "top" | "bottom" }) {
    try {
      const boardId = ctx.config.connection.board_id;
      const skeleton = ctx.cache.get(boardId) ?? normalizeBoardSkeleton(await ctx.client.getBoard(boardId));
      ctx.cache.set(boardId, skeleton);

      const cardResponse = await ctx.client.getCard(input.card_id);
      const card = cardResponse.item;
      const currentListId = card.listId;

      const currentList = skeleton.lists.find((l) => l.id === currentListId);
      const currentListName = currentList?.name ?? currentListId;

      const listNameToKey = Object.entries(ctx.config.board.lists) as [string, string][];
      const sourceKey = listNameToKey.find(([, name]) => name.toLowerCase() === currentListName.toLowerCase())?.[0];

      const targetListId = ctx.resolver.resolveListId(input.target_list);
      const targetList = skeleton.lists.find((l) => l.id === targetListId);
      const targetListName = targetList?.name ?? input.target_list;
      const targetKey = listNameToKey.find(([, name]) => name.toLowerCase() === targetListName.toLowerCase())?.[0];

      if (sourceKey && targetKey) {
        const allowedTargets = ctx.config.board.transitions[sourceKey] ?? [];
        if (!allowedTargets.includes(targetKey)) {
          const allowedNames = allowedTargets.map(
            (key) => ctx.config.board.lists[key as keyof typeof ctx.config.board.lists] ?? key,
          );
          throw new TransitionError(
            `Cannot move card from ${currentListName} to ${targetListName}`,
            currentListName,
            targetListName,
            allowedNames,
          );
        }
      }

      const positionValue = input.position === "bottom" ? 65536 * 1000 : 1;
      await ctx.client.moveCard(input.card_id, targetListId, positionValue);

      const sortRule = targetKey ? ctx.config.board.sort_rules[targetKey] : undefined;
      if (sortRule && targetList && (targetList.type === "active" || targetList.type === "closed")) {
        try {
          await ctx.client.sortList(targetListId, sortRule.field, sortRule.order);
        } catch {
          ctx.logger.warn("sort after move failed (non-fatal)");
        }
      }

      const updated = await ctx.client.getCard(input.card_id);
      const shaped = shapeCard({
        card: updated.item,
        cardLabels: updated.included.cardLabels ?? [],
        cardMemberships: updated.included.cardMemberships ?? [],
        customFieldValues: updated.included.customFieldValues ?? [],
        taskLists: updated.included.taskLists ?? [],
        tasks: updated.included.tasks ?? [],
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
      const suggestions = err instanceof TransitionError ? err.allowed : undefined;
      ctx.logger.error("move_card failed", { error: msg });
      return toolError(msg, suggestions);
    }
  },
};
