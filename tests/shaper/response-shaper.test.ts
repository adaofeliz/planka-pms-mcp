import { describe, expect, it } from "vitest";

import { isOverdue, formatSeconds } from "../../src/shaper/formatters.js";
import { shapeCard } from "../../src/shaper/response-shaper.js";

const now = new Date("2026-04-11T12:00:00.000Z");

const card = {
  id: "card-1",
  createdAt: "2026-04-01T09:00:00.000Z",
  updatedAt: "2026-04-10T09:00:00.000Z",
  type: "project" as const,
  position: 1,
  name: "Sample card",
  description: "Full description",
  dueDate: "2026-04-10T10:00:00.000Z",
  isDueCompleted: false,
  stopwatch: { total: 125, startedAt: "2026-04-11T11:00:00.000Z" },
  commentsTotal: 2,
  isClosed: false,
  listChangedAt: "2026-04-10T08:00:00.000Z",
  boardId: "board-1",
  listId: "list-backlog",
  creatorUserId: "user-1",
  prevListId: null,
  coverAttachmentId: null,
  isSubscribed: false,
};

const ctx = {
  lists: [{ id: "list-backlog", name: "BACKLOG" }],
  labels: [{ id: "label-work", name: "Work", color: "blue", position: 1, boardId: "board-1" }],
  customFields: [
    { id: "cf-priority", name: "Priority", type: "number", position: 1, customFieldGroupId: "cfg-1" },
    { id: "cf-duration", name: "Duration", type: "number", position: 2, customFieldGroupId: "cfg-1" },
    { id: "cf-scheduled", name: "Scheduled", type: "datetime", position: 3, customFieldGroupId: "cfg-1" },
  ],
  customFieldGroups: [{ id: "cfg-1", name: "Main", boardId: "board-1" }],
  priorityFieldName: "Priority",
  durationFieldName: "Duration",
};

const common = {
  card,
  cardLabels: [{ id: "cl-1", cardId: "card-1", labelId: "label-work" }],
  cardMemberships: [{ id: "cm-1", cardId: "card-1", userId: "user-2" }],
  customFieldValues: [
    { id: "cfv-1", content: "1", customFieldGroupId: "cfg-1", customFieldId: "cf-priority", cardId: "card-1" },
    { id: "cfv-2", content: "30", customFieldGroupId: "cfg-1", customFieldId: "cf-duration", cardId: "card-1" },
    { id: "cfv-3", content: "2026-04-12T09:00:00.000Z", customFieldGroupId: "cfg-1", customFieldId: "cf-scheduled", cardId: "card-1" },
  ],
  taskLists: [{ id: "tl-1", name: "Checklist", position: 1, cardId: "card-1", showOnFrontOfCard: true, hideCompletedTasks: false }],
  tasks: [
    { id: "t-1", name: "A", position: 1, isCompleted: true, taskListId: "tl-1", assigneeUserId: null },
    { id: "t-2", name: "B", position: 2, isCompleted: false, taskListId: "tl-1", assigneeUserId: null },
  ],
  comments: [{ id: "com-1", text: "note", createdAt: "2026-04-10T11:00:00.000Z", updatedAt: "2026-04-10T11:00:00.000Z", cardId: "card-1", userId: "user-1" }],
  actions: [{ id: "act-1", type: "moveCard", createdAt: "2026-04-10T12:00:00.000Z", cardId: "card-1", userId: "user-1", data: {} }],
  attachmentsCount: 1,
  commentsCount: 2,
  ctx,
  now,
};

describe("response shaper", () => {
  it("Tier 1 shape: overdue, priority, duration, labels, description, stopwatch", () => {
    const shaped = shapeCard({ ...common, tier: "t1" });

    expect(shaped.overdue).toBe(true);
    expect(shaped.priority).toBe(1);
    expect(shaped.duration_min).toBe(30);
    expect(shaped.labels).toContain("Work");
    expect(shaped.has_description).toBe(true);
    expect(shaped.stopwatch_running).toBe(true);
  });

  it("Tier 1 shape: null due date is not overdue", () => {
    const shaped = shapeCard({
      ...common,
      card: { ...card, dueDate: null },
      tier: "t1",
    });

    expect(shaped.overdue).toBe(false);
    expect(shaped.due).toBeNull();
  });

  it("Tier 2 shape includes detail additions", () => {
    const shaped = shapeCard({ ...common, tier: "t2" });

    expect(shaped).toMatchObject({
      id: "card-1",
      description: "Full description",
      comments_count: 2,
      custom_fields: {
        Priority: "1",
        Duration: "30",
      },
    });
    expect(shaped.task_lists_detail).toEqual([{ name: "Checklist", completed: 1, total: 2 }]);
  });

  it("Tier 3 shape includes comments and actions", () => {
    const shaped = shapeCard({ ...common, tier: "t3" });

    expect(shaped).toMatchObject({
      comments: [{ id: "com-1", text: "note", created: "2026-04-10T11:00:00.000Z", userId: "user-1" }],
      actions: [{ id: "act-1", type: "moveCard", created: "2026-04-10T12:00:00.000Z", userId: "user-1" }],
    });
  });

  it("formatSeconds formats seconds/minutes/hours", () => {
    expect(formatSeconds(45)).toBe("45s");
    expect(formatSeconds(90)).toBe("1m 30s");
    expect(formatSeconds(3600)).toBe("1h");
    expect(formatSeconds(3661)).toBe("1h 1m");
  });

  it("isOverdue handles past/future/null/completed", () => {
    expect(isOverdue("2026-04-10T10:00:00.000Z", false, now)).toBe(true);
    expect(isOverdue("2026-04-10T10:00:00.000Z", true, now)).toBe(false);
    expect(isOverdue(null, false, now)).toBe(false);
    expect(isOverdue("2026-04-12T10:00:00.000Z", false, now)).toBe(false);
  });
});
