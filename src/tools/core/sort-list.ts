import { z } from "zod";
import type { ToolContext } from "./shared.js";
import { toolResult, toolError } from "./shared.js";
import { normalizeBoardSkeleton } from "../../client/cache.js";
import { ValidationError } from "../../utils/errors.js";

export const sortListTool = {
  name: "sort_list" as const,
  description: "Re-sort a list according to its configured sort rule, or a specified field.",
  inputSchema: {
    list_name: z.string().min(1),
    field: z.enum(["dueDate", "createdAt", "name"]).optional(),
    order: z.enum(["asc", "desc"]).optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: false },
  async handler(ctx: ToolContext, input: { list_name: string; field?: "dueDate" | "createdAt" | "name"; order?: "asc" | "desc" }) {
    try {
      const boardId = ctx.config.connection.board_id;
      const skeleton = ctx.cache.get(boardId) ?? normalizeBoardSkeleton(await ctx.client.getBoard(boardId));
      ctx.cache.set(boardId, skeleton);

      const listId = ctx.resolver.resolveListId(input.list_name);
      const list = skeleton.lists.find((l) => l.id === listId);

      if (list && (list.type === "archive" || list.type === "trash")) {
        throw new ValidationError(`Cannot sort ${list.type} lists`, ["Only active and closed lists can be sorted"]);
      }

      const listNameToKey = Object.entries(ctx.config.board.lists) as [string, string][];
      const listKey = listNameToKey.find(([, name]) => name.toLowerCase() === (list?.name ?? "").toLowerCase())?.[0];
      const configRule = listKey ? ctx.config.board.sort_rules[listKey] : undefined;

      const sortField = input.field ?? configRule?.field ?? "dueDate";
      const sortOrder = input.order ?? configRule?.order ?? "asc";

      const result = await ctx.client.sortList(listId, sortField, sortOrder);
      const cards = (result as { items?: Array<{ name: string; dueDate: string | null }> }).items ?? [];

      return toolResult({
        list: list?.name ?? input.list_name,
        sorted_by: sortField,
        order: sortOrder,
        card_count: cards.length,
        first: cards[0] ? { name: cards[0].name, due: cards[0].dueDate?.split("T")[0] ?? null } : null,
        last: cards[cards.length - 1] ? { name: cards[cards.length - 1].name, due: cards[cards.length - 1].dueDate?.split("T")[0] ?? null } : null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logger.error("sort_list failed", { error: msg });
      return toolError(msg);
    }
  }
};
