import type { PlankaConfig } from "../../config/types.js";
import type { BoardSkeletonCache } from "../../client/cache.js";
import type { NameResolver } from "../../client/resolver.js";
import type { Logger } from "../../utils/logger.js";
import type {
  ActionsResponse,
  BoardResponse,
  CardResponse,
  CardsResponse,
  CommentResponse,
  CommentsResponse,
  PlankaCard,
  PlankaLabel,
  PlankaCustomFieldValue,
  PlankaCustomField,
  PlankaCustomFieldGroup,
  PlankaTaskList,
  PlankaTask,
} from "../../client/types.js";

export interface ToolContext {
  config: PlankaConfig;
  client: {
    getBoard: (boardId: string) => Promise<BoardResponse>;
    getBoardSkeleton: (boardId: string, forceRefresh?: boolean) => Promise<import("../../client/cache.js").BoardSkeleton>;
    getCardsByList: (listId: string, options?: { search?: string }) => Promise<CardsResponse>;
    getCard: (cardId: string) => Promise<CardResponse>;
    getComments: (cardId: string) => Promise<CommentsResponse>;
    getCardActions: (cardId: string) => Promise<ActionsResponse>;
    createCard: (listId: string, data: import("../../client/types.js").CreateCardInput) => Promise<CardResponse>;
    updateCard: (cardId: string, data: import("../../client/types.js").UpdateCardInput) => Promise<CardResponse>;
    addCardLabel: (cardId: string, labelId: string) => Promise<void>;
    removeCardLabel: (cardId: string, labelId: string) => Promise<void>;
    setCustomFieldValue: (cardId: string, groupId: string, fieldId: string, value: string) => Promise<void>;
    clearCustomFieldValue: (cardId: string, groupId: string, fieldId: string) => Promise<void>;
    moveCard: (cardId: string, targetListId: string, position?: number) => Promise<CardResponse>;
    createComment: (cardId: string, text: string) => Promise<CommentResponse>;
    archiveCard: (cardId: string, archiveListId: string) => Promise<CardResponse>;
    getArchivedCards?: (
      archiveListId: string,
      options?: import("../../client/types.js").GetCardsByListOptions,
    ) => Promise<CardsResponse>;
    createTaskList?: (cardId: string, data: import("../../client/types.js").CreateTaskListInput) => Promise<import("../../client/types.js").TaskListResponse>;
    createTask?: (taskListId: string, data: import("../../client/types.js").CreateTaskInput) => Promise<import("../../client/types.js").TaskResponse>;
    updateTask?: (taskId: string, data: import("../../client/types.js").UpdateTaskInput) => Promise<import("../../client/types.js").TaskResponse>;
    deleteTask?: (taskId: string) => Promise<import("../../client/types.js").TaskResponse>;
    deleteTaskList?: (taskListId: string) => Promise<import("../../client/types.js").TaskListResponse>;
    startStopwatch?: (cardId: string, existingTotal: number) => Promise<CardResponse>;
    stopStopwatch?: (cardId: string, existingTotal: number, startedAt: string) => Promise<CardResponse>;
    resetStopwatch?: (cardId: string) => Promise<CardResponse>;
    getStopwatchStatus?: (
      stopwatch: import("../../client/types.js").StopwatchData,
    ) => import("../../client/types.js").StopwatchStatus;
    sortList: (
      listId: string,
      fieldName: "name" | "dueDate" | "createdAt",
      order: "asc" | "desc",
    ) => Promise<unknown>;
  };
  cache: BoardSkeletonCache;
  resolver: NameResolver;
  boardId?: string;
  getResolver?: (forceRefresh?: boolean) => Promise<NameResolver>;
  now?: () => Date;
  logger: Logger;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
}

export interface CardSummary {
  id: string;
  name: string;
  position: number;
  list: string;
  due_date: string | null;
  overdue: boolean;
  priority: number | null;
  duration_min: number | null;
  labels: string[];
  has_description: boolean;
  tasks_progress: { completed: number; total: number } | null;
  stopwatch_running: boolean;
}

export function getListName(listId: string, lists: { id: string; name: string | null }[]): string {
  return lists.find((l) => l.id === listId)?.name ?? listId;
}

export function getCardLabelNames(
  cardId: string,
  cardLabels: { cardId: string; labelId: string }[],
  labels: PlankaLabel[],
): string[] {
  const labelIds = cardLabels.filter((cl) => cl.cardId === cardId).map((cl) => cl.labelId);
  return labels
    .filter((l) => labelIds.includes(l.id) && l.name !== null)
    .map((l) => l.name as string);
}

export function getCustomFieldValue(
  cardId: string,
  fieldName: string,
  customFieldValues: PlankaCustomFieldValue[],
  customFields: PlankaCustomField[],
  _customFieldGroups: PlankaCustomFieldGroup[],
): string | null {
  const field = customFields.find((f) => f.name === fieldName);
  if (!field) return null;
  const value = customFieldValues.find((v) => v.cardId === cardId && v.customFieldId === field.id);
  return value?.value ?? null;
}

export function getTaskProgress(
  cardId: string,
  taskLists: PlankaTaskList[],
  tasks: PlankaTask[],
): { completed: number; total: number } | null {
  const cardTaskLists = taskLists.filter((tl) => tl.cardId === cardId);
  if (cardTaskLists.length === 0) return null;
  const taskListIds = cardTaskLists.map((tl) => tl.id);
  const cardTasks = tasks.filter((t) => taskListIds.includes(t.taskListId));
  if (cardTasks.length === 0) return null;
  const completed = cardTasks.filter((t) => t.isCompleted).length;
  return { completed, total: cardTasks.length };
}

export function normalizeCardSummary(
  card: PlankaCard,
  listName: string,
  labelNames: string[],
  priority: number | null,
  duration_min: number | null,
  tasksProgress: { completed: number; total: number } | null,
): CardSummary {
  const now = new Date();
  const due_date = card.dueDate;
  const overdue = Boolean(card.dueDate && !card.isDueCompleted && new Date(card.dueDate) < now);

  return {
    id: card.id,
    name: card.name,
    position: card.position,
    list: listName,
    due_date,
    overdue,
    priority,
    duration_min,
    labels: labelNames,
    has_description: Boolean(card.description && card.description.trim().length > 0),
    tasks_progress: tasksProgress,
    stopwatch_running: card.stopwatch?.startedAt !== null && card.stopwatch?.startedAt !== undefined,
  };
}

export function shapeCardForTier(
  card: Record<string, unknown>,
  tiers: PlankaConfig["response"],
  level: "summary" | "detail" | "deep",
): Record<string, unknown> {
  const fields = [
    ...tiers.tier1,
    ...(level === "summary" ? [] : tiers.tier2_additions),
    ...(level === "deep" ? tiers.tier3_additions : []),
  ];

  const shaped: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in card) {
      shaped[field] = card[field];
    }
  }

  return shaped;
}

export function shapeCardsForTier(
  cards: unknown[],
  tiers: PlankaConfig["response"],
  level: "summary" | "detail" | "deep",
): Array<Record<string, unknown>> {
  return cards.map((card) => shapeCardForTier(card as Record<string, unknown>, tiers, level));
}

export function toolResult(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function toTextResult(payload: unknown): { content: Array<{ type: "text"; text: string }> } {
  return toolResult(payload);
}

export function isOverdue(dueDate: string | null | undefined, isDueCompleted: boolean | undefined, now: Date): boolean {
  if (!dueDate || isDueCompleted) {
    return false;
  }

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return false;
  }

  return due.getTime() < now.getTime();
}

export function toolError(
  message: string,
  suggestions?: string[],
): { content: Array<{ type: "text"; text: string }> } {
  const body: { error: string; suggestions?: string[] } = { error: message };
  if (suggestions?.length) body.suggestions = suggestions;
  return {
    content: [{ type: "text" as const, text: JSON.stringify(body, null, 2) }],
  };
}
