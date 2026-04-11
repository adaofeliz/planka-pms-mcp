import type { PlankaConfig } from "../../config/types.js";
import type { PlankaClient } from "../../client/planka-client.js";
import type { BoardSkeletonCache } from "../../client/cache.js";
import type { NameResolver } from "../../client/resolver.js";
import type { Logger } from "../../utils/logger.js";
import type {
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
  client: PlankaClient;
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
  due: string | null;
  overdue: boolean;
  priority: number | null;
  duration_min: number | null;
  labels: string[];
  has_description: boolean;
  tasks_progress: { completed: number; total: number } | null;
  stopwatch_running: boolean;
}

export function getListName(listId: string, lists: { id: string; name: string }[]): string {
  return lists.find((l) => l.id === listId)?.name ?? listId;
}

export function getCardLabelNames(
  cardId: string,
  cardLabels: { cardId: string; labelId: string }[],
  labels: PlankaLabel[],
): string[] {
  const labelIds = cardLabels.filter((cl) => cl.cardId === cardId).map((cl) => cl.labelId);
  return labels.filter((l) => labelIds.includes(l.id)).map((l) => l.name);
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
  const due = card.dueDate ? card.dueDate.split("T")[0] : null;
  const overdue = Boolean(card.dueDate && !card.isDueCompleted && new Date(card.dueDate) < now);

  return {
    id: card.id,
    name: card.name,
    position: card.position,
    list: listName,
    due,
    overdue,
    priority,
    duration_min,
    labels: labelNames,
    has_description: Boolean(card.description && card.description.trim().length > 0),
    tasks_progress: tasksProgress,
    stopwatch_running: card.stopwatch.startedAt !== null,
  };
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
