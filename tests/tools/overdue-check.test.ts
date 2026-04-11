import { describe, expect, it, vi } from "vitest";

import { overdueCheckTool } from "../../src/tools/core/overdue-check.js";
import type { ToolContext } from "../../src/tools/core/shared.js";
import type { PlankaConfig } from "../../src/config/types.js";
import { BoardSkeletonCache, type BoardSkeleton } from "../../src/client/cache.js";
import { NameResolver } from "../../src/client/resolver.js";
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
    labels: { categories: { domain: [], source: [], type: [] }, required_on_triage: [] },
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
      { id: "l-today", createdAt: "", updatedAt: "", name: "TODAY", position: 1, color: null, type: "active", boardId: "board-1" },
      { id: "l-backlog", createdAt: "", updatedAt: "", name: "BACKLOG", position: 2, color: null, type: "active", boardId: "board-1" },
      { id: "l-inbox", createdAt: "", updatedAt: "", name: "INBOX", position: 3, color: null, type: "active", boardId: "board-1" },
      { id: "l-done", createdAt: "", updatedAt: "", name: "DONE", position: 4, color: null, type: "closed", boardId: "board-1" },
    ],
    labels: [],
    cardLabels: [],
    customFieldGroups: [{ id: "cfg", name: "Main", boardId: "board-1" }],
    customFields: [
      { id: "cf-priority", name: "Priority", type: "number", position: 1, customFieldGroupId: "cfg-1" },
      { id: "cf-duration", name: "Duration", type: "number", position: 2, customFieldGroupId: "cfg-1" },
    ],
    members: [],
    cards: [
      {
        id: "o-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        type: "project",
        position: 1,
        name: "Very stale",
        description: null,
        dueDate: "2025-12-01T00:00:00.000Z",
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
      {
        id: "t-1",
        createdAt: "2026-01-09T00:00:00.000Z",
        updatedAt: "2026-01-09T00:00:00.000Z",
        type: "project",
        position: 2,
        name: "Today one",
        description: null,
        dueDate: null,
        isDueCompleted: false,
        stopwatch: { total: 0, startedAt: null },
        commentsTotal: 0,
        isClosed: false,
        listChangedAt: "2026-01-09T00:00:00.000Z",
        boardId: "board-1",
        listId: "l-today",
        creatorUserId: "u-1",
        prevListId: null,
        coverAttachmentId: null,
        isSubscribed: false,
      },
      {
        id: "t-2",
        createdAt: "2026-01-09T00:00:00.000Z",
        updatedAt: "2026-01-09T00:00:00.000Z",
        type: "project",
        position: 3,
        name: "Today two",
        description: null,
        dueDate: null,
        isDueCompleted: false,
        stopwatch: { total: 0, startedAt: null },
        commentsTotal: 0,
        isClosed: false,
        listChangedAt: "2026-01-09T00:00:00.000Z",
        boardId: "board-1",
        listId: "l-today",
        creatorUserId: "u-1",
        prevListId: null,
        coverAttachmentId: null,
        isSubscribed: false,
      },
      {
        id: "t-3",
        createdAt: "2026-01-09T00:00:00.000Z",
        updatedAt: "2026-01-09T00:00:00.000Z",
        type: "project",
        position: 4,
        name: "Today three",
        description: null,
        dueDate: null,
        isDueCompleted: false,
        stopwatch: { total: 0, startedAt: null },
        commentsTotal: 0,
        isClosed: false,
        listChangedAt: "2026-01-09T00:00:00.000Z",
        boardId: "board-1",
        listId: "l-today",
        creatorUserId: "u-1",
        prevListId: null,
        coverAttachmentId: null,
        isSubscribed: false,
      },
    ],
    doneListId: "l-done",
  };
}

function makeContext(): ToolContext {
  const cfg = config();
  const skel = skeleton();
  const resolver = new NameResolver(skel, cfg);
  const cache = new BoardSkeletonCache(300_000);
  cache.set(cfg.connection.board_id, skel);

  const client: ToolContext["client"] = {
    getBoard: vi.fn(async () => ({ item: skel.board, included: { boardMemberships: [], labels: [], lists: skel.lists, cards: skel.cards, cardMemberships: [], cardLabels: [], taskLists: [], tasks: [], customFieldGroups: skel.customFieldGroups, customFields: skel.customFields, customFieldValues: [], users: [], projects: [], attachments: [] } })),
    getBoardSkeleton: vi.fn(async () => skel),
    getCardsByList: vi.fn(async () => ({ items: [], included: { cardLabels: [], cardMemberships: [], taskLists: [], tasks: [], customFieldGroups: [], customFields: [], customFieldValues: [], users: [] } })),
    getCard: vi.fn(async (cardId: string) => ({
      item: skel.cards.find((card) => card.id === cardId)!,
      included: {
        taskLists: [],
        tasks: [],
        cardLabels: [],
        cardMemberships: [],
        attachments: [],
        customFieldGroups: [],
        customFields: [],
        customFieldValues: [
          { id: `p-${cardId}`, content: "5", customFieldGroupId: "cfg", customFieldId: "cf-priority", cardId },
          { id: `d-${cardId}`, content: "120", customFieldGroupId: "cfg", customFieldId: "cf-duration", cardId },
        ],
      },
    })),
    getComments: vi.fn(async () => ({ items: [], included: { users: [] } })),
    getCardActions: vi.fn(async () => ({ items: [], included: { users: [] } })),
    createCard: vi.fn(async () => {
      throw new Error("not used");
    }),
    updateCard: vi.fn(async () => {
      throw new Error("not used");
    }),
    addCardLabel: vi.fn(async () => {
      throw new Error("not used");
    }),
    removeCardLabel: vi.fn(async () => {
      throw new Error("not used");
    }),
    setCustomFieldValue: vi.fn(async () => {
      throw new Error("not used");
    }),
    clearCustomFieldValue: vi.fn(async () => {
      throw new Error("not used");
    }),
    moveCard: vi.fn(async () => {
      throw new Error("not used");
    }),
    createComment: vi.fn(async () => {
      throw new Error("not used");
    }),
    sortList: vi.fn(async () => {
      throw new Error("not used");
    }),
  };

  return {
    config: cfg,
    client,
    cache,
    resolver,
    getResolver: async () => resolver,
    logger: createLogger("test"),
    now: () => new Date("2026-01-10T00:00:00.000Z"),
  };
}

describe("overdue_check", () => {
  it("returns stale warning, priority-aware suggestions and never-extend warning", async () => {
    const context = makeContext();
    const result = await overdueCheckTool.handler(context, {});
    const payload = JSON.parse(result.content[0].text) as {
      overdue_cards: Array<{ card_id: string }>;
      warnings: string[];
      suggestions: Array<{ type: string; card_id: string }>;
      requires_human_approval: boolean;
    };

    expect(payload.overdue_cards).toHaveLength(1);
    expect(payload.overdue_cards[0].card_id).toBe("o-1");
    expect(payload.warnings.some((warning) => warning.includes("stale"))).toBe(true);
    expect(payload.warnings.some((warning) => warning.includes("Never extend other tasks' due dates"))).toBe(true);
    expect(payload.suggestions.some((suggestion) => suggestion.type === "deprioritize_today")).toBe(true);
    expect(payload.suggestions.some((suggestion) => suggestion.type === "split_duration")).toBe(true);
    expect(payload.suggestions.some((suggestion) => suggestion.type === "reassess_relevance")).toBe(true);
    expect(payload.requires_human_approval).toBe(true);
  });
});
