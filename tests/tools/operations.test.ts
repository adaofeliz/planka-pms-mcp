import { describe, expect, it, vi } from "vitest";

import type { ToolContext } from "../../src/tools/core/shared.js";
import { manageChecklistTool } from "../../src/tools/core/manage-checklist.js";
import { addCommentTool } from "../../src/tools/core/add-comment.js";
import { searchArchiveTool } from "../../src/tools/core/search-archive.js";
import { NameResolver } from "../../src/client/resolver.js";
import { BoardSkeletonCache, type BoardSkeleton } from "../../src/client/cache.js";
import type { PlankaConfig } from "../../src/config/types.js";
import { createLogger } from "../../src/utils/logger.js";

function config(): PlankaConfig {
  return {
    connection: { base_url: "https://planka.example.com", api_key: "k", board_id: "board-1" },
    board: {
      card_type: "project",
      lists: {
        inbox: "INBOX",
        backlog: "BACKLOG",
        noise: "NOISE",
        focus: "FOCUS",
        today: "TODAY",
        active: "ACTIVE",
        blocked: "BLOCKED",
        calendar: "CALENDAR",
        done: "DONE",
      },
      wip_limits: {},
      transitions: {},
      default_capture_list: "inbox",
      sort_rules: {},
      archive: { never_delete_done: true, search_enabled: true, page_size: 50 },
      due_date_windows: { approaching: { min_hours: 24, max_hours: 72 }, imminent: { max_hours: 24 } },
    },
    labels: { categories: { domain: ["Work"], source: [], type: [] }, required_on_triage: [] },
    custom_fields: {
      priority: { field_name: "Priority", type: "number", show_in_summary: true, required_on_triage: true },
      duration: { field_name: "Duration", type: "number", show_in_summary: true, required_on_triage: true },
      scheduled: { field_name: "Scheduled", type: "datetime", show_in_summary: false, required_on_triage: false },
    },
    pomodoro: { work_interval_minutes: 30, rest_interval_minutes: 10, intervals_before_long_rest: 4, long_rest_minutes: 30 },
    forgiving_system: {
      enabled: true,
      rules: {
        never_extend_other_due_dates: true,
        suggest_deprioritize_today: true,
        suggest_split_duration: true,
        always_surface_overdue: true,
      },
    },
    response: { tier1: ["id"], tier2_additions: ["description"], tier3_additions: ["comments"] },
    tools: { generate: [] },
    cache: { skeleton_ttl_seconds: 300, preload: true },
  };
}

function skeleton(): BoardSkeleton {
  return {
    board: { id: "board-1", name: "Main", defaultCardType: "project" },
    lists: [
      { id: "l-inbox", createdAt: "", updatedAt: "", name: "INBOX", position: 1, color: null, type: "active", boardId: "board-1" },
      { id: "l-archive", createdAt: "", updatedAt: "", name: "Archive", position: 2, color: null, type: "archive", boardId: "board-1" },
      { id: "l-done", createdAt: "", updatedAt: "", name: "DONE", position: 3, color: null, type: "closed", boardId: "board-1" },
    ],
    labels: [{ id: "lab-work", name: "Work", color: "blue", position: 1, boardId: "board-1" }],
    cardLabels: [],
    customFieldGroups: [{ id: "cfg-1", name: "Main", boardId: "board-1" }],
    customFields: [
      { id: "cf-priority", name: "Priority", type: "number", position: 1 },
      { id: "cf-duration", name: "Duration", type: "number", position: 2 },
    ],
    members: [],
    cards: [],
    doneListId: "l-done",
    archiveListId: "l-archive",
  };
}

function makeContext(): ToolContext {
  const cfg = config();
  const skel = skeleton();
  const cache = new BoardSkeletonCache(300_000);
  cache.set(cfg.connection.board_id, skel);
  const resolver = new NameResolver(skel, cfg);

  const cardDetail = {
    item: {
      id: "card-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      type: "project" as const,
      position: 1,
      name: "Card",
      description: null,
      dueDate: null,
      isDueCompleted: false,
      stopwatch: { total: 0, startedAt: null },
      commentsTotal: 0,
      isClosed: false,
      listChangedAt: "2026-01-01T00:00:00.000Z",
      boardId: "board-1",
      listId: "l-inbox",
      creatorUserId: "u-1",
      prevListId: null,
      coverAttachmentId: null,
      isSubscribed: false,
    },
    included: {
      taskLists: [{ id: "tl-1", name: "Main", position: 1, cardId: "card-1", showOnFrontOfCard: true, hideCompletedTasks: false }],
      tasks: [{ id: "t-1", name: "Task", position: 1, isCompleted: false, taskListId: "tl-1", assigneeUserId: null }],
      cardLabels: [],
      cardMemberships: [],
      attachments: [],
      customFieldGroups: [],
      customFields: [],
      customFieldValues: [],
    },
  };

  const client: ToolContext["client"] = {
    getBoard: vi.fn(async () => ({
      item: skel.board,
      included: {
        boardMemberships: [],
        labels: skel.labels,
        lists: skel.lists,
        cards: [],
        cardMemberships: [],
        cardLabels: [],
        taskLists: [],
        tasks: [],
        customFieldGroups: skel.customFieldGroups,
        customFields: skel.customFields,
        customFieldValues: [],
        users: [],
        projects: [],
        attachments: [],
      },
    })),
    getBoardSkeleton: vi.fn(async () => skel),
    getCardsByList: vi.fn(async () => ({ items: [], included: { cardLabels: [], cardMemberships: [], taskLists: [], tasks: [], customFieldGroups: [], customFields: [], customFieldValues: [], users: [] } })),
    getCard: vi.fn(async () => cardDetail),
    getComments: vi.fn(async () => ({ items: [], included: { users: [] } })),
    getCardActions: vi.fn(async () => ({ items: [], included: { users: [] } })),
    createCard: vi.fn(async () => cardDetail),
    updateCard: vi.fn(async () => cardDetail),
    addCardLabel: vi.fn(async () => {}),
    removeCardLabel: vi.fn(async () => {}),
    setCustomFieldValue: vi.fn(async () => {}),
    clearCustomFieldValue: vi.fn(async () => {}),
    moveCard: vi.fn(async () => cardDetail),
    createComment: vi.fn(async () => ({ item: { id: "cm-1", text: "hello", cardId: "card-1", userId: "u-1", createdAt: "2026-01-01", updatedAt: "2026-01-01" }, included: { users: [] } })),
    archiveCard: vi.fn(async () => cardDetail),
    sortList: vi.fn(async () => ({})),
    createTaskList: vi.fn(async () => ({ item: { id: "tl-2", name: "Extra", position: 2, cardId: "card-1", showOnFrontOfCard: true, hideCompletedTasks: false }, included: { tasks: [] } })),
    createTask: vi.fn(async () => ({ item: { id: "t-2", name: "new", position: 2, isCompleted: false, taskListId: "tl-1", assigneeUserId: null } })),
    updateTask: vi.fn(async () => ({ item: { id: "t-1", name: "Task", position: 1, isCompleted: true, taskListId: "tl-1", assigneeUserId: null } })),
    deleteTask: vi.fn(async () => ({ item: { id: "t-1", name: "Task", position: 1, isCompleted: false, taskListId: "tl-1", assigneeUserId: null } })),
    deleteTaskList: vi.fn(async () => ({ item: { id: "tl-1", name: "Main", position: 1, cardId: "card-1", showOnFrontOfCard: true, hideCompletedTasks: false }, included: { tasks: [] } })),
    getArchivedCards: vi.fn(async (_archiveListId: string, options?: { search?: string }) => ({
      items: [
        {
          id: "a-1",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          type: "project" as const,
          position: 1,
          name: "Fix API",
          description: "critical regex target",
          dueDate: null,
          isDueCompleted: true,
          stopwatch: { total: 0, startedAt: null },
          commentsTotal: 0,
          isClosed: true,
          listChangedAt: "2026-01-05T00:00:00.000Z",
          boardId: "board-1",
          listId: "l-archive",
          creatorUserId: "u-1",
          prevListId: "l-done",
          coverAttachmentId: null,
          isSubscribed: false,
        },
        {
          id: "a-2",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          type: "project" as const,
          position: 2,
          name: "Write docs",
          description: options?.search === "Fix" ? "won't match" : "misc",
          dueDate: null,
          isDueCompleted: true,
          stopwatch: { total: 0, startedAt: null },
          commentsTotal: 0,
          isClosed: true,
          listChangedAt: "2026-01-04T00:00:00.000Z",
          boardId: "board-1",
          listId: "l-archive",
          creatorUserId: "u-1",
          prevListId: "l-done",
          coverAttachmentId: null,
          isSubscribed: false,
        },
      ],
      included: {
        cardLabels: [{ id: "cl-1", cardId: "a-1", labelId: "lab-work" }],
        cardMemberships: [],
        taskLists: [],
        tasks: [],
        customFieldGroups: [],
        customFields: [],
        customFieldValues: [],
        users: [],
      },
    })),
  };

  return {
    config: cfg,
    client,
    cache,
    resolver,
    logger: createLogger("test"),
    boardId: cfg.connection.board_id,
  };
}

describe("operations tools", () => {
  it("manage_checklist add_list calls createTaskList with name", async () => {
    const ctx = makeContext();
    await manageChecklistTool.handler(ctx, { card_id: "card-1", action: "add_list", list_name: "Extra" });
    expect(vi.mocked(ctx.client.createTaskList!)).toHaveBeenCalledWith(
      "card-1",
      expect.objectContaining({ name: "Extra" }),
    );
  });

  it("manage_checklist toggle_task fetches card and toggles completion", async () => {
    const ctx = makeContext();
    await manageChecklistTool.handler(ctx, { card_id: "card-1", action: "toggle_task", task_id: "t-1" });
    expect(vi.mocked(ctx.client.getCard)).toHaveBeenCalledWith("card-1");
    expect(vi.mocked(ctx.client.updateTask!)).toHaveBeenCalledWith("t-1", { isCompleted: true });
  });

  it("manage_checklist returns error when required add_task params missing", async () => {
    const ctx = makeContext();
    const result = await manageChecklistTool.handler(ctx, { card_id: "card-1", action: "add_task", task_list_id: "tl-1" });
    const payload = JSON.parse(result.content[0].text) as { error: string };
    expect(payload.error).toContain("task_list_id and task_name required");
  });

  it("add_comment calls createComment and returns comment_id", async () => {
    const ctx = makeContext();
    const result = await addCommentTool.handler(ctx, { card_id: "card-1", text: "hello world" });
    expect(vi.mocked(ctx.client.createComment)).toHaveBeenCalledWith("card-1", "hello world");
    const payload = JSON.parse(result.content[0].text) as { comment_id: string };
    expect(payload.comment_id).toBe("cm-1");
  });

  it("search_archive calls getArchivedCards and returns results", async () => {
    const ctx = makeContext();
    const result = await searchArchiveTool.handler(ctx, { query: "Fix" });
    expect(vi.mocked(ctx.client.getArchivedCards!)).toHaveBeenCalledWith("l-archive", { search: "Fix" });
    const payload = JSON.parse(result.content[0].text) as { results: Array<{ id: string }> };
    expect(payload.results.length).toBeGreaterThan(0);
  });

  it("search_archive regex filters MCP-side without API search param", async () => {
    const ctx = makeContext();
    const result = await searchArchiveTool.handler(ctx, { query: "/regex" });
    expect(vi.mocked(ctx.client.getArchivedCards!)).toHaveBeenCalledWith("l-archive", { search: undefined });
    const payload = JSON.parse(result.content[0].text) as { results: Array<{ id: string }> };
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0].id).toBe("a-1");
  });

  it("search_archive label filter returns only matching cards", async () => {
    const ctx = makeContext();
    const result = await searchArchiveTool.handler(ctx, { labels: ["Work"] });
    const payload = JSON.parse(result.content[0].text) as { results: Array<{ id: string }> };
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0].id).toBe("a-1");
  });
});
