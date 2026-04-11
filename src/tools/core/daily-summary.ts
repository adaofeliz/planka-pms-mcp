import { z } from "zod";

import { isOverdue, toolResult, type ToolContext } from "./shared.js";

const inputSchema = {
  force_refresh: z.boolean().optional().describe("Force refresh board skeleton before summarizing"),
};

type DailySummaryInput = {
  force_refresh?: boolean;
};

export const dailySummaryTool = {
  name: "daily_summary",
  description: "Aggregate daily view for TODAY, ACTIVE, BLOCKED, FOCUS, overdue, INBOX, and DONE pending archive",
  inputSchema,
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    destructiveHint: false,
  },
  async handler(context: ToolContext, input: DailySummaryInput): Promise<ReturnType<typeof toolResult>> {
    const now = context.now?.() ?? new Date();
    const boardId = context.config.connection.board_id;
    const skeleton = await context.client.getBoardSkeleton(boardId, input.force_refresh ?? false);
    const resolver = context.getResolver
      ? await context.getResolver(input.force_refresh ?? false)
      : context.resolver;

    const todayListId = resolver.resolveTodayListId();
    const activeListId = resolver.resolveListId(context.config.board.lists.active);
    const blockedListId = resolver.resolveBlockedListId();
    const focusListId = context.config.board.lists.focus
      ? resolver.resolveListId(context.config.board.lists.focus)
      : undefined;
    const inboxListId = resolver.resolveInboxListId();
    const doneListId = resolver.resolveDoneListId();

    const cards = skeleton.cards;
    const inList = (listId: string | undefined) =>
      listId ? cards.filter((card) => card.listId === listId) : [];

    const overdueCards = cards.filter((card) => isOverdue(card.dueDate, card.isDueCompleted, now));
    const donePendingArchive = inList(doneListId).filter((card) => card.prevListId !== skeleton.archiveListId);

    return toolResult({
      board: {
        id: skeleton.board.id,
        name: skeleton.board.name,
      },
      today: {
        total: inList(todayListId).length,
      },
      active: {
        total: inList(activeListId).length,
      },
      blocked: {
        total: inList(blockedListId).length,
      },
      focus: {
        total: inList(focusListId).length,
      },
      overdue: {
        total: overdueCards.length,
      },
      inbox: {
        total: inList(inboxListId).length,
      },
      done_pending_archive: {
        total: donePendingArchive.length,
      },
      generated_at: now.toISOString(),
    });
  },
};
