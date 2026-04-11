import { z } from "zod";
import type { ToolContext } from "./shared.js";
import { toolResult, toolError } from "./shared.js";
import { normalizeBoardSkeleton } from "../../client/cache.js";
import { shapeCard } from "../../shaper/response-shaper.js";

export const searchArchiveTool = {
  name: "search_archive" as const,
  description: "Search past completed tasks in the archive. Acts as a contextual diary. Prefix query with / for regex.",
  inputSchema: {
    query: z.string().optional().describe("Text search (prefix / for regex filtering)"),
    labels: z.array(z.string()).optional().describe("Filter by label names"),
    limit: z.number().int().positive().optional().default(10),
    board_id: z.string().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false },
  async handler(ctx: ToolContext, input: {
    query?: string;
    labels?: string[];
    limit?: number;
    board_id?: string;
  }) {
    try {
      if (!ctx.client.getArchivedCards) {
        return toolError("getArchivedCards not available");
      }

      const boardId = input.board_id ?? ctx.config.connection.board_id;
      const skeleton = ctx.cache.get(boardId) ?? normalizeBoardSkeleton(await ctx.client.getBoard(boardId));
      ctx.cache.set(boardId, skeleton);

      const archiveListId = ctx.resolver.resolveArchiveListId();

      const isRegex = input.query?.startsWith("/");
      const apiSearch = isRegex ? undefined : input.query;

      const response = await ctx.client.getArchivedCards(archiveListId, {
        search: apiSearch,
      });

      let cards = response.items;

      if (isRegex && input.query) {
        try {
          const body = input.query.slice(1);
          const lastSlash = body.lastIndexOf("/");
          const regex =
            lastSlash > -1
              ? new RegExp(body.slice(0, lastSlash), body.slice(lastSlash + 1))
              : new RegExp(body, "i");
          const pattern = regex;
          cards = cards.filter((c) => pattern.test(c.name) || (c.description && pattern.test(c.description)));
        } catch {
          return toolError(`Invalid regex pattern: ${input.query}`);
        }
      }

      if (input.labels?.length) {
        const expected = new Set(input.labels.map((label) => label.toLowerCase()));
        cards = cards.filter((card) => {
          const cardLabelIds = (response.included.cardLabels ?? [])
            .filter((cl) => cl.cardId === card.id)
            .map((cl) => cl.labelId);
          const cardLabelNames = skeleton.labels
            .filter((label) => cardLabelIds.includes(label.id))
            .map((label) => label.name.toLowerCase());
          return cardLabelNames.some((name) => expected.has(name));
        });
      }

      const limit = input.limit ?? 10;
      const hasMore = cards.length > limit;
      const sliced = cards.slice(0, limit);

      const shaperCtx = {
        lists: skeleton.lists,
        labels: skeleton.labels,
        customFields: skeleton.customFields,
        customFieldGroups: skeleton.customFieldGroups,
        priorityFieldName: ctx.config.custom_fields.priority.field_name,
        durationFieldName: ctx.config.custom_fields.duration.field_name,
      };

      const results = sliced.map((card) => shapeCard({
        card,
        cardLabels: response.included.cardLabels ?? [],
        cardMemberships: [],
        customFieldValues: response.included.customFieldValues ?? [],
        taskLists: response.included.taskLists ?? [],
        tasks: response.included.tasks ?? [],
        ctx: shaperCtx,
        tier: "t1",
      }));

      return toolResult({
        results,
        total_scanned: cards.length,
        has_more: hasMore,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logger.error("search_archive failed", { error: msg });
      return toolError(msg);
    }
  }
};
