import { z } from "zod";

import { isOverdue, toolResult, type ToolContext } from "./shared.js";
import { NotFoundError } from "../../utils/errors.js";
import { groupCardsByDueDateWindow } from "../../scheduling/due-date-windows.js";
import { evaluateConfiguredWipLimits, getWipWarnings } from "../../scheduling/wip-limits.js";
import { analyzeForgivingSuggestions } from "../../scheduling/forgiving.js";

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
    let focusListId: string | undefined;
    if (context.config.board.lists.focus) {
      try {
        focusListId = resolver.resolveListId(context.config.board.lists.focus);
      } catch (error) {
        if (!(error instanceof NotFoundError)) {
          throw error;
        }
      }
    }
    const inboxListId = resolver.resolveInboxListId();
    const doneListId = resolver.resolveDoneListId();

    const cards = skeleton.cards;
    const inList = (listId: string | undefined) =>
      listId ? cards.filter((card) => card.listId === listId) : [];

    const overdueCards = cards.filter((card) => isOverdue(card.dueDate, card.isDueCompleted, now));
    const donePendingArchive = inList(doneListId).filter((card) => card.prevListId !== skeleton.archiveListId);
    const byWindow = groupCardsByDueDateWindow(cards, context.config.board.due_date_windows, now);

    let noiseListId: string | undefined;
    if (context.config.board.lists.noise) {
      try {
        noiseListId = resolver.resolveListId(context.config.board.lists.noise);
      } catch (error) {
        if (!(error instanceof NotFoundError)) {
          throw error;
        }
      }
    }

    const roleCounts = {
      noise: noiseListId ? inList(noiseListId).length : 0,
      focus: focusListId ? inList(focusListId).length : 0,
    };
    const wipStatuses = evaluateConfiguredWipLimits(roleCounts, context.config.board.wip_limits);
    const wipWarnings = getWipWarnings(wipStatuses);

    const promotionSuggestions = {
      imminent: byWindow.imminent.map((card) => ({ card_id: card.id, name: card.name, suggestion: "Promote to TODAY immediately" })),
      approaching: byWindow.approaching.map((card) => ({ card_id: card.id, name: card.name, suggestion: "Plan promotion window soon" })),
    };

    const forgiving = analyzeForgivingSuggestions(
      overdueCards.map((card) => ({
        card_id: card.id,
        name: card.name,
        due_date: card.dueDate,
        days_overdue: card.dueDate ? Math.max(0, Math.floor((now.getTime() - new Date(card.dueDate).getTime()) / (1000 * 60 * 60 * 24))) : 0,
        priority: null,
        duration_min: null,
      })),
      inList(todayListId).length,
      context.config.forgiving_system,
    );

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
      scheduling: {
        by_due_window: {
          overdue: byWindow.overdue.length,
          imminent: byWindow.imminent.length,
          approaching: byWindow.approaching.length,
          backlog_safe: byWindow.backlog_safe.length,
          unscheduled: byWindow.unscheduled.length,
        },
        promotion_suggestions: promotionSuggestions,
      },
      wip: {
        statuses: wipStatuses,
        warnings: wipWarnings,
      },
      forgiving: {
        warnings: forgiving.warnings,
        suggestions: forgiving.suggestions,
      },
      generated_at: now.toISOString(),
    });
  },
};
