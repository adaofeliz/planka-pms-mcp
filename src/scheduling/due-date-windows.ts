import type { DueDateWindowsConfig } from "../config/types.js";

export type DueDateWindowBucket = "unscheduled" | "overdue" | "imminent" | "approaching" | "backlog_safe";

export interface DueDateClassification {
  bucket: DueDateWindowBucket;
  dueDate: string | null;
  hoursUntilDue: number | null;
}

function hoursUntil(dueDate: Date, now: Date): number {
  return (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
}

export function classifyDueDate(
  dueDate: string | null | undefined,
  windows: DueDateWindowsConfig,
  now: Date,
): DueDateClassification {
  if (!dueDate) {
    return { bucket: "unscheduled", dueDate: null, hoursUntilDue: null };
  }

  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) {
    return { bucket: "unscheduled", dueDate: null, hoursUntilDue: null };
  }

  const hours = hoursUntil(parsed, now);
  if (hours < 0) {
    return { bucket: "overdue", dueDate, hoursUntilDue: hours };
  }

  if (hours <= windows.imminent.max_hours) {
    return { bucket: "imminent", dueDate, hoursUntilDue: hours };
  }

  const minApproaching = windows.approaching.min_hours ?? 0;
  if (hours >= minApproaching && hours <= windows.approaching.max_hours) {
    return { bucket: "approaching", dueDate, hoursUntilDue: hours };
  }

  return { bucket: "backlog_safe", dueDate, hoursUntilDue: hours };
}

export function groupCardsByDueDateWindow<T extends { dueDate: string | null | undefined }>(
  cards: T[],
  windows: DueDateWindowsConfig,
  now: Date,
): Record<DueDateWindowBucket, T[]> {
  const grouped: Record<DueDateWindowBucket, T[]> = {
    unscheduled: [],
    overdue: [],
    imminent: [],
    approaching: [],
    backlog_safe: [],
  };

  for (const card of cards) {
    const classification = classifyDueDate(card.dueDate, windows, now);
    grouped[classification.bucket].push(card);
  }

  return grouped;
}
