import { z } from "zod";

import {
  getCardLabelNames,
  getCustomFieldValue,
  getListName,
  getTaskProgress,
  normalizeCardSummary,
  toolResult,
  type ToolContext,
} from "./shared.js";

const inputSchema = {
  query: z.string().optional().describe("Optional text query"),
  labels: z.array(z.string()).optional().describe("Optional label names filter"),
  overdue: z.boolean().optional().describe("Filter by overdue status"),
  priority: z.number().int().optional().describe("Filter by priority custom field"),
  has_due_date: z.boolean().optional().describe("Filter by due date presence"),
  lists: z.array(z.string()).optional().describe("Restrict search to list names"),
};

type SearchCardsInput = {
  query?: string;
  labels?: string[];
  overdue?: boolean;
  priority?: number;
  has_due_date?: boolean;
  lists?: string[];
};

function parseNumber(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export const searchCardsTool = {
  name: "search_cards",
  description: "Search cards across active and closed lists with filters",
  inputSchema,
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    destructiveHint: false,
  },
  async handler(context: ToolContext, input: SearchCardsInput): Promise<ReturnType<typeof toolResult>> {
    const boardId = context.config.connection.board_id;
    const skeleton = (context.cache.get(boardId) ?? (await context.client.getBoardSkeleton(boardId)));
    if (!context.cache.get(boardId)) {
      context.cache.set(boardId, skeleton);
    }

    const targetListIds = new Set(
      skeleton.lists
        .filter((list) => list.type === "active" || list.type === "closed")
        .filter((list) => {
          if (!input.lists?.length) return true;
          const expected = new Set(input.lists.map((name) => name.toLowerCase()));
          return expected.has(list.name.toLowerCase());
        })
        .map((list) => list.id),
    );

    const deduped = new Map<string, ReturnType<typeof normalizeCardSummary>>();

    for (const listId of targetListIds) {
      const response = await context.client.getCardsByList(listId, input.query ? { search: input.query } : undefined);
      const listName = getListName(listId, skeleton.lists);

      for (const card of response.items) {
        if (deduped.has(card.id)) {
          continue;
        }

        const labels = getCardLabelNames(card.id, response.included.cardLabels ?? [], skeleton.labels);
        const priority = parseNumber(
          getCustomFieldValue(
            card.id,
            context.config.custom_fields.priority.field_name,
            response.included.customFieldValues ?? [],
            skeleton.customFields,
            skeleton.customFieldGroups,
          ),
        );
        const duration = parseNumber(
          getCustomFieldValue(
            card.id,
            context.config.custom_fields.duration.field_name,
            response.included.customFieldValues ?? [],
            skeleton.customFields,
            skeleton.customFieldGroups,
          ),
        );
        const tasksProgress = getTaskProgress(card.id, response.included.taskLists ?? [], response.included.tasks ?? []);

        deduped.set(card.id, normalizeCardSummary(card, listName, labels, priority, duration, tasksProgress));
      }
    }

    let cards = Array.from(deduped.values());

    if (input.labels?.length) {
      const expected = new Set(input.labels.map((label) => label.toLowerCase()));
      cards = cards.filter((card) => card.labels.some((label) => expected.has(label.toLowerCase())));
    }

    if (input.overdue !== undefined) {
      cards = cards.filter((card) => card.overdue === input.overdue);
    }

    if (input.priority !== undefined) {
      cards = cards.filter((card) => card.priority === input.priority);
    }

    if (input.has_due_date !== undefined) {
      cards = cards.filter((card) => (input.has_due_date ? card.due !== null : card.due === null));
    }

    cards.sort((a, b) => a.name.localeCompare(b.name));

    return toolResult({
      query: input.query ?? null,
      total: cards.length,
      cards,
    });
  },
};
