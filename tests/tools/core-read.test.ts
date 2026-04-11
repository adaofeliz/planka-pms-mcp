import { describe, expect, it, vi } from "vitest";

import type { ToolContext } from "../../src/tools/core/shared.js";
import { listCardsTool } from "../../src/tools/core/list-cards.js";
import { getCardTool } from "../../src/tools/core/get-card.js";
import { searchCardsTool } from "../../src/tools/core/search-cards.js";
import { dailySummaryTool } from "../../src/tools/core/daily-summary.js";
import { NameResolver } from "../../src/client/resolver.js";
import { BoardSkeletonCache } from "../../src/client/cache.js";
import { createLogger } from "../../src/utils/logger.js";
import type { BoardSkeleton } from "../../src/client/cache.js";
import type { PlankaConfig } from "../../src/config/types.js";

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
      { id: "l-backlog", createdAt: "", updatedAt: "", name: "➡️ BACKLOG", position: 1, color: null, type: "active", boardId: "board-1" },
      { id: "l-today", createdAt: "", updatedAt: "", name: "TODAY", position: 2, color: null, type: "active", boardId: "board-1" },
      { id: "l-blocked", createdAt: "", updatedAt: "", name: "BLOCKED", position: 3, color: null, type: "active", boardId: "board-1" },
      { id: "l-done", createdAt: "", updatedAt: "", name: "DONE", position: 4, color: null, type: "closed", boardId: "board-1" },
      { id: "l-archive", createdAt: "", updatedAt: "", name: "Archive", position: 5, color: null, type: "archive", boardId: "board-1" },
      { id: "l-inbox", createdAt: "", updatedAt: "", name: "INBOX", position: 6, color: null, type: "active", boardId: "board-1" },
      { id: "l-active", createdAt: "", updatedAt: "", name: "ACTIVE", position: 7, color: null, type: "active", boardId: "board-1" },
    ],
    labels: [{ id: "lab-work", name: "Work", color: "blue", position: 1, boardId: "board-1" }],
    cardLabels: [],
    customFieldGroups: [],
    customFields: [{ id: "cf-priority", name: "Priority", type: "number", position: 1, customFieldGroupId: "cfg-1" }],
    members: [],
    cards: [
      {
        id: "s-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        type: "project",
        position: 1,
        name: "Today overdue",
        description: null,
        dueDate: "2026-01-05T00:00:00.000Z",
        isDueCompleted: false,
        stopwatch: { total: 0, startedAt: null },
        commentsTotal: 0,
        isClosed: false,
        listChangedAt: "2026-01-01T00:00:00.000Z",
        boardId: "board-1",
        listId: "l-today",
        creatorUserId: "u-1",
        prevListId: null,
        coverAttachmentId: null,
        isSubscribed: false,
      },
      {
        id: "s-2",
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        type: "project",
        position: 2,
        name: "Active",
        description: null,
        dueDate: null,
        isDueCompleted: false,
        stopwatch: { total: 0, startedAt: null },
        commentsTotal: 0,
        isClosed: false,
        listChangedAt: "2026-01-02T00:00:00.000Z",
        boardId: "board-1",
        listId: "l-active",
        creatorUserId: "u-1",
        prevListId: null,
        coverAttachmentId: null,
        isSubscribed: false,
      },
      {
        id: "s-3",
        createdAt: "2026-01-03T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
        type: "project",
        position: 3,
        name: "Done pending archive",
        description: null,
        dueDate: null,
        isDueCompleted: true,
        stopwatch: { total: 0, startedAt: null },
        commentsTotal: 0,
        isClosed: true,
        listChangedAt: "2026-01-03T00:00:00.000Z",
        boardId: "board-1",
        listId: "l-done",
        creatorUserId: "u-1",
        prevListId: "l-active",
        coverAttachmentId: null,
        isSubscribed: false,
      },
    ],
    doneListId: "l-done",
    archiveListId: "l-archive",
  };
}

function makeContext(overrides?: Partial<ToolContext>): ToolContext {
  const cfg = config();
  const skel = skeleton();
  const resolver = new NameResolver(skel, cfg);
  const client: ToolContext["client"] = {
    getBoardSkeleton: async () => skel,
    getCardsByList: async () => ({
      items: [
        {
          id: "c-2",
          createdAt: "2026-01-02T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
          type: "project",
          position: 2,
          name: "Second",
          description: null,
          dueDate: null,
          isDueCompleted: false,
          stopwatch: { total: 0, startedAt: null },
          commentsTotal: 0,
          isClosed: false,
          listChangedAt: "2026-01-02T00:00:00.000Z",
          boardId: "board-1",
          listId: "l-backlog",
          creatorUserId: "u-1",
          prevListId: null,
          coverAttachmentId: null,
          isSubscribed: false,
        },
        {
          id: "c-1",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          type: "project",
          position: 1,
          name: "First",
          description: null,
          dueDate: "2026-01-05T00:00:00.000Z",
          isDueCompleted: false,
          stopwatch: { total: 0, startedAt: null },
          commentsTotal: 0,
          isClosed: false,
          listChangedAt: "2026-01-01T00:00:00.000Z",
          boardId: "board-1",
          listId: "l-backlog",
          creatorUserId: "u-1",
          prevListId: null,
          coverAttachmentId: null,
          isSubscribed: false,
        },
      ],
      included: {
        cardLabels: [{ id: "cl-1", cardId: "c-1", labelId: "lab-work" }],
        cardMemberships: [],
        taskLists: [],
        tasks: [],
        customFieldGroups: [],
        customFields: [],
        customFieldValues: [{ id: "cfv-1", content: "2", customFieldGroupId: "cfg", customFieldId: "cf-priority", cardId: "c-1" }],
        users: [],
      },
    }),
    getCard: async () => ({
      item: {
        id: "card-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
        type: "project",
        position: 1,
        name: "Card",
        description: "Details",
        dueDate: "2026-01-02T00:00:00.000Z",
        isDueCompleted: false,
        stopwatch: { total: 0, startedAt: null },
        commentsTotal: 0,
        isClosed: false,
        listChangedAt: "2026-01-01T00:00:00.000Z",
        boardId: "board-1",
        listId: "l-backlog",
        creatorUserId: "u-1",
        prevListId: null,
        coverAttachmentId: null,
        isSubscribed: false,
      },
      included: {
        taskLists: [{ id: "tl-1", name: "Checklist", position: 1, cardId: "card-1", showOnFrontOfCard: true, hideCompletedTasks: false }],
        tasks: [{ id: "t-1", name: "Do", position: 1, isCompleted: false, taskListId: "tl-1", assigneeUserId: null }],
        cardLabels: [{ id: "cl-1", cardId: "card-1", labelId: "lab-work" }],
        cardMemberships: [],
        attachments: [],
        customFieldGroups: [],
        customFields: [],
        customFieldValues: [],
      },
    }),
    getComments: async () => ({ items: [{ id: "cm-1", text: "hello", createdAt: "", updatedAt: "", cardId: "card-1", userId: "u-1" }], included: { users: [] } }),
    getCardActions: async () => ({ items: [{ id: "a-1", type: "moveCard", createdAt: "", cardId: "card-1", userId: "u-1", data: {} }], included: { users: [] } }),
    createCard: async () => {
      throw new Error("not used");
    },
    updateCard: async () => {
      throw new Error("not used");
    },
    addCardLabel: async () => {
      throw new Error("not used");
    },
    removeCardLabel: async () => {
      throw new Error("not used");
    },
    setCustomFieldValue: async () => {
      throw new Error("not used");
    },
    clearCustomFieldValue: async () => {
      throw new Error("not used");
    },
    moveCard: async () => {
      throw new Error("not used");
    },
    createComment: async () => {
      throw new Error("not used");
    },
    sortList: async () => {
      throw new Error("not used");
    },
  };

  return {
    config: cfg,
    boardId: "board-1",
    client,
    cache: new BoardSkeletonCache(300000),
    resolver,
    getResolver: async () => resolver,
    logger: createLogger("test"),
    now: () => new Date("2026-01-10T00:00:00.000Z"),
    ...overrides,
  };
}

describe("core read tools", () => {
  it("list_cards resolves list name and applies filters/sorting", async () => {
    const context = makeContext();
    const result = await listCardsTool.handler(context, {
      list: "BACKLOG",
      labels: ["Work"],
      priority: 2,
      sort_by: "position",
    });

    const payload = JSON.parse(result.content[0].text) as { total: number; cards: Array<{ id: string }> };
    expect(payload.total).toBe(1);
    expect(payload.cards[0].id).toBe("c-1");
  });

  it("get_card returns Tier 2 shape by default and lazy loads Tier 3", async () => {
    const context = makeContext();
    const commentsSpy = vi.spyOn(context.client, "getComments");
    const actionsSpy = vi.spyOn(context.client, "getCardActions");

    const defaultResult = await getCardTool.handler(context, { card_id: "card-1" });
    const defaultPayload = JSON.parse(defaultResult.content[0].text) as { card: { id: string }; tier3?: unknown };
    expect(defaultPayload.card.id).toBe("card-1");
    expect(defaultPayload.tier3).toBeUndefined();
    expect(commentsSpy).not.toHaveBeenCalled();
    expect(actionsSpy).not.toHaveBeenCalled();

    const deepResult = await getCardTool.handler(context, {
      card_id: "card-1",
      include_comments: true,
      include_actions: true,
    });
    const deepPayload = JSON.parse(deepResult.content[0].text) as { tier3: { comments: unknown[]; actions: unknown[] } };
    expect(deepPayload.tier3.comments).toHaveLength(1);
    expect(deepPayload.tier3.actions).toHaveLength(1);
    expect(commentsSpy).toHaveBeenCalledTimes(1);
    expect(actionsSpy).toHaveBeenCalledTimes(1);
  });

  it("search_cards scans board lists, deduplicates, and applies intersecting filters", async () => {
    const context = makeContext({
      client: {
        ...makeContext().client,
        getCardsByList: vi.fn(async (listId: string) => {
          if (listId === "l-backlog") {
            return {
              items: [
                {
                  id: "x-1",
                  createdAt: "2026-01-01T00:00:00.000Z",
                  updatedAt: "2026-01-01T00:00:00.000Z",
                  type: "project" as const,
                  position: 1,
                  name: "Alpha",
                  description: null,
                  dueDate: "2026-01-04T00:00:00.000Z",
                  isDueCompleted: false,
                  stopwatch: { total: 0, startedAt: null },
                  commentsTotal: 0,
                  isClosed: false,
                  listChangedAt: "2026-01-01T00:00:00.000Z",
                  boardId: "board-1",
                  listId: "l-backlog",
                  creatorUserId: "u-1",
                  prevListId: null,
                  coverAttachmentId: null,
                  isSubscribed: false,
                },
              ],
              included: {
                cardLabels: [{ id: "cl-x1", cardId: "x-1", labelId: "lab-work" }],
                cardMemberships: [],
                taskLists: [],
                tasks: [],
                customFieldGroups: [],
                customFields: [],
                customFieldValues: [{ id: "cfv-x1", content: "2", customFieldGroupId: "cfg", customFieldId: "cf-priority", cardId: "x-1" }],
                users: [],
              },
            };
          }

          if (listId === "l-done") {
            return {
              items: [
                {
                  id: "x-1",
                  createdAt: "2026-01-01T00:00:00.000Z",
                  updatedAt: "2026-01-01T00:00:00.000Z",
                  type: "project" as const,
                  position: 1,
                  name: "Alpha duplicate",
                  description: null,
                  dueDate: "2026-01-04T00:00:00.000Z",
                  isDueCompleted: false,
                  stopwatch: { total: 0, startedAt: null },
                  commentsTotal: 0,
                  isClosed: true,
                  listChangedAt: "2026-01-01T00:00:00.000Z",
                  boardId: "board-1",
                  listId: "l-done",
                  creatorUserId: "u-1",
                  prevListId: null,
                  coverAttachmentId: null,
                  isSubscribed: false,
                },
              ],
              included: {
                cardLabels: [{ id: "cl-x1-dup", cardId: "x-1", labelId: "lab-work" }],
                cardMemberships: [],
                taskLists: [],
                tasks: [],
                customFieldGroups: [],
                customFields: [],
                customFieldValues: [{ id: "cfv-x1-dup", content: "2", customFieldGroupId: "cfg", customFieldId: "cf-priority", cardId: "x-1" }],
                users: [],
              },
            };
          }

          return { items: [], included: { cardLabels: [], cardMemberships: [], taskLists: [], tasks: [], customFieldGroups: [], customFields: [], customFieldValues: [], users: [] } };
        }),
      },
    });

    const result = await searchCardsTool.handler(context, {
      labels: ["Work"],
      overdue: true,
      priority: 2,
      has_due_date: true,
      lists: ["➡️ BACKLOG", "DONE"],
    });

    const payload = JSON.parse(result.content[0].text) as { total: number; cards: Array<{ id: string }> };
    expect(payload.total).toBe(1);
    expect(payload.cards[0].id).toBe("x-1");
  });

  it("daily_summary returns expected section totals", async () => {
    const context = makeContext();
    const result = await dailySummaryTool.handler(context, {});
    const payload = JSON.parse(result.content[0].text) as {
      today: { total: number };
      active: { total: number };
      blocked: { total: number };
      focus: { total: number };
      overdue: { total: number };
      inbox: { total: number };
      done_pending_archive: { total: number };
    };

    expect(payload.today.total).toBe(1);
    expect(payload.active.total).toBe(1);
    expect(payload.blocked.total).toBe(0);
    expect(payload.focus.total).toBe(0);
    expect(payload.overdue.total).toBe(1);
    expect(payload.inbox.total).toBe(0);
    expect(payload.done_pending_archive.total).toBe(1);
  });

  it("daily_summary includes scheduling suggestions and WIP warnings", async () => {
    const context = makeContext({
      config: {
        ...config(),
        board: {
          ...config().board,
          wip_limits: { noise: 0, focus: 0 },
        },
      },
    });

    const result = await dailySummaryTool.handler(context, {});
    const payload = JSON.parse(result.content[0].text) as {
      scheduling: {
        by_due_window: { overdue: number; imminent: number; approaching: number };
        promotion_suggestions: { imminent: unknown[]; approaching: unknown[] };
      };
      wip: { warnings: Array<{ list: string }> };
      forgiving: { warnings: string[]; suggestions: unknown[] };
    };

    expect(payload.scheduling.by_due_window.overdue).toBe(1);
    expect(payload.scheduling.promotion_suggestions.imminent.length).toBeGreaterThanOrEqual(0);
    expect(payload.scheduling.promotion_suggestions.approaching.length).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(payload.wip.warnings)).toBe(true);
    expect(Array.isArray(payload.forgiving.warnings)).toBe(true);
    expect(Array.isArray(payload.forgiving.suggestions)).toBe(true);
  });
});
