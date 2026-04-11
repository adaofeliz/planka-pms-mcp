import { z } from "zod";
import type { ToolContext } from "./shared.js";
import { toolResult, toolError, getCardLabelNames } from "./shared.js";
import { normalizeBoardSkeleton } from "../../client/cache.js";

export const boardOverviewSchema = {
  board_id: z.string().optional().describe("Board ID (uses default from config if not provided)"),
};

export const boardOverviewTool = {
  name: "board_overview" as const,
  description:
    "Get the current state of the board including all lists with card counts and key metrics. Use at session start or for daily standup.",
  inputSchema: boardOverviewSchema,
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    destructiveHint: false,
  },
};

export async function boardOverviewHandler(
  params: { board_id?: string },
  ctx: ToolContext,
): Promise<ReturnType<typeof toolResult>> {
  const boardId = params.board_id ?? ctx.config.connection.board_id;

  try {
    const boardResponse = await ctx.client.getBoard(boardId);
    const skeleton = normalizeBoardSkeleton(boardResponse);

    ctx.cache.set(boardId, skeleton);

    const { board, lists, labels, cards } = skeleton;
    const cardLabels = boardResponse.included.cardLabels ?? [];

    const activeLists = lists.filter((l) => l.type === "active" || l.type === "closed");

    const listCounts = activeLists
      .map((list) => {
        const count = cards.filter((c) => c.listId === list.id).length;
        return {
          name: list.name,
          count,
          type: list.type,
        };
      })
      .sort(() => 0);

    const now = new Date();
    const overdueCount = cards.filter(
      (c) =>
        c.dueDate &&
        !c.isDueCompleted &&
        new Date(c.dueDate) < now &&
        activeLists.some((l) => l.id === c.listId),
    ).length;

    const domainLabels = ctx.config.labels.categories.domain;
    const labelsSummary: Record<string, number> = {};

    for (const card of cards) {
      const cardLabelNames = getCardLabelNames(card.id, cardLabels, labels);
      for (const labelName of cardLabelNames) {
        if (domainLabels.includes(labelName)) {
          labelsSummary[labelName] = (labelsSummary[labelName] ?? 0) + 1;
        }
      }
    }

    return toolResult({
      board: board.name,
      lists: listCounts,
      total_cards: cards.filter((c) => activeLists.some((l) => l.id === c.listId)).length,
      overdue_count: overdueCount,
      labels_summary: labelsSummary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.logger.error("board_overview failed", { error: message });
    return toolError(message);
  }
}
