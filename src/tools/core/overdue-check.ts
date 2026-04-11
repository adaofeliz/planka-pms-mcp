import { z } from "zod";

import { analyzeForgivingSuggestions, type OverdueCardInput } from "../../scheduling/forgiving.js";
import { isOverdue, toolResult, type ToolContext } from "./shared.js";

const inputSchema = {
  force_refresh: z.boolean().optional().describe("Force refresh board skeleton cache before analysis"),
};

type OverdueCheckInput = {
  force_refresh?: boolean;
};

function daysOverdue(dueDate: string | null, now: Date): number {
  if (!dueDate) {
    return 0;
  }
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return 0;
  }
  const diffMs = now.getTime() - due.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function parseNumeric(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export const overdueCheckTool = {
  name: "overdue_check",
  description: "Read-only overdue analysis with forgiving suggestions",
  inputSchema,
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    destructiveHint: false,
  },
  async handler(context: ToolContext, input: OverdueCheckInput): Promise<ReturnType<typeof toolResult>> {
    const now = context.now?.() ?? new Date();
    const boardId = context.config.connection.board_id;
    const skeleton = await context.client.getBoardSkeleton(boardId, input.force_refresh ?? false);

    const overdueCards = skeleton.cards.filter((card) => isOverdue(card.dueDate, card.isDueCompleted, now));
    const resolver = context.getResolver ? await context.getResolver(input.force_refresh ?? false) : context.resolver;
    const todayListId = resolver.resolveTodayListId();
    const todayWorkloadCount = skeleton.cards.filter((card) => card.listId === todayListId).length;

    const priorityField = skeleton.customFields.find(
      (field) => field.name.toLowerCase() === context.config.custom_fields.priority.field_name.toLowerCase(),
    );
    const durationField = skeleton.customFields.find(
      (field) => field.name.toLowerCase() === context.config.custom_fields.duration.field_name.toLowerCase(),
    );

    const enriched: OverdueCardInput[] = [];
    for (const card of overdueCards) {
      const details = await context.client.getCard(card.id);
      const values = details.included.customFieldValues ?? [];

      const priority = priorityField
        ? parseNumeric(values.find((value) => value.customFieldId === priorityField.id)?.value)
        : null;
      const duration = durationField
        ? parseNumeric(values.find((value) => value.customFieldId === durationField.id)?.value)
        : null;

      enriched.push({
        card_id: card.id,
        name: card.name,
        due_date: card.dueDate,
        days_overdue: daysOverdue(card.dueDate, now),
        priority,
        duration_min: duration,
      });
    }

    const analysis = analyzeForgivingSuggestions(enriched, todayWorkloadCount, context.config.forgiving_system);

    return toolResult({
      generated_at: now.toISOString(),
      overdue_cards: enriched,
      warnings: analysis.warnings,
      suggestions: analysis.suggestions,
      requires_human_approval: true,
      note: "No automatic changes were made. Review suggestions and apply manually.",
    });
  },
};
