import type {
  PlankaCard,
  PlankaLabel,
  PlankaCustomFieldValue,
  PlankaCustomField,
  PlankaCustomFieldGroup,
  PlankaTaskList,
  PlankaTask,
  PlankaComment,
  PlankaAction,
  PlankaCardLabel,
  PlankaCardMembership,
} from "../client/types.js";
import { formatDate, isOverdue } from "./formatters.js";

export interface ShaperContext {
  lists: { id: string; name: string }[];
  labels: PlankaLabel[];
  customFields: PlankaCustomField[];
  customFieldGroups: PlankaCustomFieldGroup[];
  priorityFieldName: string;
  durationFieldName: string;
}

export interface CardTier1 {
  id: string;
  name: string;
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

export interface CardTier2 extends CardTier1 {
  description: string | null;
  members: string[];
  task_lists_detail: Array<{ name: string; completed: number; total: number }>;
  attachments_count: number;
  comments_count: number;
  custom_fields: Record<string, string>;
  scheduled: string | null;
  stopwatch_total_seconds: number;
  created: string;
  last_moved: string;
}

export interface CardTier3 extends CardTier2 {
  comments: Array<{ id: string; text: string; created: string; userId: string }>;
  actions: Array<{ id: string; type: string; created: string; userId: string }>;
}

function getCustomFieldValue(
  cardId: string,
  fieldName: string,
  customFieldValues: PlankaCustomFieldValue[],
  customFields: PlankaCustomField[],
): string | null {
  const field = customFields.find((f) => f.name === fieldName);
  if (!field) return null;
  const val = customFieldValues.find((v) => v.cardId === cardId && v.customFieldId === field.id);
  return val?.value ?? null;
}

function getTaskProgress(
  cardId: string,
  taskLists: PlankaTaskList[],
  tasks: PlankaTask[],
): { completed: number; total: number } | null {
  const tls = taskLists.filter((tl) => tl.cardId === cardId);
  if (tls.length === 0) return null;
  const tlIds = tls.map((tl) => tl.id);
  const cardTasks = tasks.filter((t) => tlIds.includes(t.taskListId));
  if (cardTasks.length === 0) return null;
  return { completed: cardTasks.filter((t) => t.isCompleted).length, total: cardTasks.length };
}

export interface ShapeCardOptions {
  card: PlankaCard;
  cardLabels: PlankaCardLabel[];
  cardMemberships: PlankaCardMembership[];
  customFieldValues: PlankaCustomFieldValue[];
  taskLists: PlankaTaskList[];
  tasks: PlankaTask[];
  comments?: PlankaComment[];
  actions?: PlankaAction[];
  attachmentsCount?: number;
  commentsCount?: number;
  ctx: ShaperContext;
  tier: "t1" | "t2" | "t3";
  now?: Date;
}

export function shapeCard(opts: ShapeCardOptions): CardTier1 | CardTier2 | CardTier3 {
  const now = opts.now ?? new Date();
  const { card, ctx } = opts;

  const listName = ctx.lists.find((l) => l.id === card.listId)?.name ?? card.listId;

  const labelIds = opts.cardLabels.filter((cl) => cl.cardId === card.id).map((cl) => cl.labelId);
  const labelNames = ctx.labels
    .filter((l) => labelIds.includes(l.id) && l.name !== null)
    .map((l) => l.name as string);

  const priorityRaw = getCustomFieldValue(card.id, ctx.priorityFieldName, opts.customFieldValues, ctx.customFields);
  const durationRaw = getCustomFieldValue(card.id, ctx.durationFieldName, opts.customFieldValues, ctx.customFields);
  const priority = priorityRaw !== null ? Number(priorityRaw) : null;
  const duration_min = durationRaw !== null ? Number(durationRaw) : null;

  const tasks_progress = getTaskProgress(card.id, opts.taskLists, opts.tasks);

  const tier1: CardTier1 = {
    id: card.id,
    name: card.name,
    list: listName,
    due: formatDate(card.dueDate),
    overdue: isOverdue(card.dueDate, card.isDueCompleted, now),
    priority: Number.isFinite(priority as number) ? priority : null,
    duration_min: Number.isFinite(duration_min as number) ? duration_min : null,
    labels: labelNames,
    has_description: !!card.description?.trim(),
    tasks_progress,
    stopwatch_running: card.stopwatch?.startedAt != null,
  };

  if (opts.tier === "t1") return tier1;

  const taskListsDetail = opts.taskLists
    .filter((tl) => tl.cardId === card.id)
    .map((tl) => {
      const tlTasks = opts.tasks.filter((t) => t.taskListId === tl.id);
      return {
        name: tl.name,
        completed: tlTasks.filter((t) => t.isCompleted).length,
        total: tlTasks.length,
      };
    });

  const allCustomFields: Record<string, string> = {};
  for (const cfv of opts.customFieldValues.filter((v) => v.cardId === card.id)) {
    const field = ctx.customFields.find((f) => f.id === cfv.customFieldId);
    if (field) allCustomFields[field.name] = cfv.value;
  }

  const scheduledRaw = getCustomFieldValue(card.id, "Scheduled", opts.customFieldValues, ctx.customFields);

  const tier2: CardTier2 = {
    ...tier1,
    description: card.description,
    members: opts.cardMemberships.filter((m) => m.cardId === card.id).map((m) => m.userId),
    task_lists_detail: taskListsDetail,
    attachments_count: opts.attachmentsCount ?? 0,
    comments_count: opts.commentsCount ?? card.commentsTotal,
    custom_fields: allCustomFields,
    scheduled: scheduledRaw,
    stopwatch_total_seconds: card.stopwatch?.total ?? 0,
    created: formatDate(card.createdAt) ?? card.createdAt,
    last_moved: formatDate(card.listChangedAt) ?? card.listChangedAt,
  };

  if (opts.tier === "t2") return tier2;

  return {
    ...tier2,
    comments: (opts.comments ?? []).map((c) => ({
      id: c.id,
      text: c.text,
      created: c.createdAt,
      userId: c.userId,
    })),
    actions: (opts.actions ?? []).map((a) => ({
      id: a.id,
      type: a.type,
      created: a.createdAt,
      userId: a.userId,
    })),
  };
}
