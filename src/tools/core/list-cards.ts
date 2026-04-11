import { z } from "zod";

import { normalizeBoardSkeleton, type BoardSkeleton } from "../../client/cache.js";
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
  list: z.string().min(1).describe("List name to query"),
  labels: z.array(z.string()).optional().describe("Optional label names filter"),
  priority: z.number().int().optional().describe("Optional priority filter"),
  sort_by: z.enum(["position", "due_date", "priority", "created"]).optional(),
};

type ListCardsInput = {
  list: string;
  labels?: string[];
  priority?: number;
  sort_by?: "position" | "due_date" | "priority" | "created";
};

function parseNumber(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export const listCardsTool = {
  name: "list_cards",
  description: "List cards in a named list with optional filters",
  inputSchema,
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    destructiveHint: false,
  },
  async handler(context: ToolContext, input: ListCardsInput): Promise<ReturnType<typeof toolResult>> {
    const boardId = context.config.connection.board_id;
    const cachedSkeleton = context.cache.get(boardId);
    const legacyClient = context.client as unknown as {
      getBoardSkeleton?: (id: string) => Promise<BoardSkeleton>;
    };
    const skeleton =
      cachedSkeleton ??
      ("getBoard" in context.client
        ? normalizeBoardSkeleton(await context.client.getBoard(boardId))
        : await legacyClient.getBoardSkeleton?.(boardId));
    if (!skeleton) {
      throw new Error("Unable to load board skeleton");
    }
    if (!cachedSkeleton) {
      context.cache.set(boardId, skeleton);
    }

    const listId = context.resolver.resolveListId(input.list);
    const response = await context.client.getCardsByList(listId);
    const listName = getListName(listId, skeleton.lists);

    let cards = response.items.map((card) => {
      const labelNames = getCardLabelNames(card.id, response.included.cardLabels ?? [], skeleton.labels);
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
      const progress = getTaskProgress(card.id, response.included.taskLists ?? [], response.included.tasks ?? []);

      return {
        card,
        summary: normalizeCardSummary(card, listName, labelNames, priority, duration, progress),
      };
    });

    if (input.labels?.length) {
      const expected = new Set(input.labels.map((label) => label.toLowerCase()));
      cards = cards.filter(({ summary }) => summary.labels.some((label) => expected.has(label.toLowerCase())));
    }

    if (input.priority !== undefined) {
      cards = cards.filter(({ summary }) => summary.priority === input.priority);
    }

    const sortBy = input.sort_by ?? "position";
    cards.sort((a, b) => {
      if (sortBy === "position") return a.card.position - b.card.position;
      if (sortBy === "created") return a.card.createdAt.localeCompare(b.card.createdAt);
      if (sortBy === "due_date") {
        const aDue = a.summary.due ? new Date(a.summary.due).getTime() : Number.POSITIVE_INFINITY;
        const bDue = b.summary.due ? new Date(b.summary.due).getTime() : Number.POSITIVE_INFINITY;
        return aDue - bDue;
      }
      return (a.summary.priority ?? Number.POSITIVE_INFINITY) - (b.summary.priority ?? Number.POSITIVE_INFINITY);
    });

    return toolResult({
      list: input.list,
      total: cards.length,
      cards: cards.map((entry) => entry.summary),
    });
  },
};
