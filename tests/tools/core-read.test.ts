import { describe, expect, it, vi } from "vitest";

import type { ToolContext } from "../../src/tools/core/shared.js";
import { listCardsTool } from "../../src/tools/core/list-cards.js";
import { getCardTool } from "../../src/tools/core/get-card.js";
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
    customFields: [{ id: "cf-priority", name: "Priority", type: "number", position: 1 }],
    members: [],
    cards: [],
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
        customFieldValues: [{ id: "cfv-1", value: "2", customFieldGroupId: "cfg", customFieldId: "cf-priority", cardId: "c-1" }],
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
});
