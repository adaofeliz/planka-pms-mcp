import { z } from "zod";

import { shapeCardForTier, toolResult, type ToolContext } from "./shared.js";

const inputSchema = {
  card_id: z.string().min(1).describe("Card ID"),
  include_comments: z.boolean().optional(),
  include_actions: z.boolean().optional(),
};

type GetCardInput = {
  card_id: string;
  include_comments?: boolean;
  include_actions?: boolean;
};

function isOverdue(dueDate: string | null | undefined, isDueCompleted: boolean | undefined, now: Date): boolean {
  if (!dueDate || isDueCompleted) return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < now.getTime();
}

export const getCardTool = {
  name: "get_card",
  description: "Get card detail (Tier 2 default, optional Tier 3 comments/actions)",
  inputSchema,
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    destructiveHint: false,
  },
  async handler(context: ToolContext, input: GetCardInput): Promise<ReturnType<typeof toolResult>> {
    const now = new Date();
    const response = await context.client.getCard(input.card_id);
    const card = response.item;

    const detail = {
      id: card.id,
      name: card.name,
      list: card.listId,
      priority: null,
      duration_min: null,
      labels: [],
      has_description: Boolean(card.description && card.description.trim().length > 0),
      tasks_progress: null,
      stopwatch_running: card.stopwatch.startedAt !== null,
      description: card.description,
      due_date: card.dueDate,
      overdue: isOverdue(card.dueDate, card.isDueCompleted, now),
      members: [],
      task_lists: response.included.taskLists ?? [],
      task_lists_detail: response.included.taskLists ?? [],
      comments_count: card.commentsTotal,
      custom_fields: response.included.customFieldValues ?? [],
      scheduled: null,
      stopwatch_total_seconds: card.stopwatch.total,
      created: card.createdAt,
      last_moved: card.listChangedAt,
      comments: [] as unknown[],
      actions: [] as unknown[],
      attachments_detail: [] as unknown[],
    };

    const tier3: { comments?: unknown[]; actions?: unknown[] } = {};

    if (input.include_comments) {
      tier3.comments = (await context.client.getComments(input.card_id)).items;
      detail.comments = tier3.comments;
    }

    if (input.include_actions) {
      tier3.actions = (await context.client.getCardActions(input.card_id)).items;
      detail.actions = tier3.actions;
    }

    const level = input.include_comments || input.include_actions ? "deep" : "detail";
    const shapedCard = shapeCardForTier(detail, context.config.response, level);

    return toolResult({
      card: shapedCard,
      ...(input.include_comments || input.include_actions ? { tier3 } : {}),
    });
  },
};
