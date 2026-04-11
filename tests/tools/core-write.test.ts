import { describe, expect, it, vi } from "vitest";

import type { ToolContext } from "../../src/tools/core/shared.js";
import { createCardTool } from "../../src/tools/core/create-card.js";
import { updateCardTool } from "../../src/tools/core/update-card.js";
import { NameResolver } from "../../src/client/resolver.js";
import { BoardSkeletonCache, type BoardSkeleton } from "../../src/client/cache.js";
import { createLogger } from "../../src/utils/logger.js";
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
    response: {
      tier1: ["id", "name", "list", "due", "overdue", "priority", "duration_min", "labels", "has_description", "tasks_progress", "stopwatch_running"],
      tier2_additions: ["description", "members", "task_lists_detail", "attachments_count", "comments_count", "custom_fields", "scheduled", "stopwatch_total_seconds", "created", "last_moved"],
      tier3_additions: ["comments", "actions"],
    },
    tools: { generate: [] },
    cache: { skeleton_ttl_seconds: 300, preload: true },
  };
}

function skeleton(): BoardSkeleton {
  return {
    board: { id: "board-1", name: "Main", defaultCardType: "project" },
    lists: [
      { id: "l-inbox", createdAt: "", updatedAt: "", name: "INBOX", position: 1, color: null, type: "active", boardId: "board-1" },
      { id: "l-backlog", createdAt: "", updatedAt: "", name: "BACKLOG", position: 2, color: null, type: "active", boardId: "board-1" },
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
    archiveListId: undefined,
  };
}

function cardDetail(cardId = "card-1") {
  return {
    item: {
      id: cardId,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      type: "project" as const,
      position: 1,
      name: "Card",
      description: "desc",
      dueDate: "2026-01-10T00:00:00.000Z",
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
      taskLists: [],
      tasks: [],
      cardLabels: [{ id: "cl-1", cardId, labelId: "lab-work" }],
      cardMemberships: [],
      attachments: [],
      customFieldGroups: [],
      customFields: [],
      customFieldValues: [
        { id: "v-1", value: "1", customFieldGroupId: "cfg-1", customFieldId: "cf-priority", cardId },
        { id: "v-2", value: "30", customFieldGroupId: "cfg-1", customFieldId: "cf-duration", cardId },
      ],
    },
  };
}

function makeContext(): ToolContext {
  const cfg = config();
  const skel = skeleton();
  const resolver = new NameResolver(skel, cfg);
  const cache = new BoardSkeletonCache(300_000);
  cache.set(cfg.connection.board_id, skel);

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
    getCardsByList: vi.fn(async () => ({
      items: [],
      included: { cardLabels: [], cardMemberships: [], taskLists: [], tasks: [], customFieldGroups: [], customFields: [], customFieldValues: [], users: [] },
    })),
    getCard: vi.fn(async (cardId: string) => cardDetail(cardId)),
    getComments: vi.fn(async () => ({ items: [], included: { users: [] } })),
    getCardActions: vi.fn(async () => ({ items: [], included: { users: [] } })),
    createCard: vi.fn(async () => cardDetail("card-1")),
    updateCard: vi.fn(async () => cardDetail("card-1")),
    addCardLabel: vi.fn(async () => {}),
    removeCardLabel: vi.fn(async () => {}),
    setCustomFieldValue: vi.fn(async () => {}),
    clearCustomFieldValue: vi.fn(async () => {}),
    moveCard: vi.fn(async () => cardDetail("card-1")),
    sortList: vi.fn(async () => ({})),
  };

  return {
    config: cfg,
    client,
    cache,
    resolver,
    boardId: cfg.connection.board_id,
    logger: createLogger("test"),
  };
}

describe("core write tools", () => {
  it("create_card calls createCard with project type and name", async () => {
    const context = makeContext();

    await createCardTool.handler(context, { name: "New task" });

    expect(vi.mocked(context.client.createCard)).toHaveBeenCalledWith(
      "l-inbox",
      expect.objectContaining({ type: "project", name: "New task" }),
    );
  });

  it("create_card defaults list_name to INBOX", async () => {
    const context = makeContext();

    await createCardTool.handler(context, { name: "New task" });

    expect(vi.mocked(context.client.createCard)).toHaveBeenCalledWith("l-inbox", expect.any(Object));
  });

  it("create_card adds each requested label", async () => {
    const context = makeContext();

    await createCardTool.handler(context, { name: "New task", labels: ["Work"] });

    expect(vi.mocked(context.client.addCardLabel)).toHaveBeenCalledWith("card-1", "lab-work");
  });

  it("create_card returns shaped tier 1 result with card id", async () => {
    const context = makeContext();

    const result = await createCardTool.handler(context, { name: "New task" });
    const payload = JSON.parse(result.content[0].text) as { id: string };

    expect(payload.id).toBe("card-1");
  });

  it("update_card calls updateCard with name", async () => {
    const context = makeContext();

    await updateCardTool.handler(context, { card_id: "card-1", name: "Renamed" });

    expect(vi.mocked(context.client.updateCard)).toHaveBeenCalledWith("card-1", expect.objectContaining({ name: "Renamed" }));
  });

  it("update_card adds labels from labels_add", async () => {
    const context = makeContext();

    await updateCardTool.handler(context, { card_id: "card-1", labels_add: ["Work"] });

    expect(vi.mocked(context.client.addCardLabel)).toHaveBeenCalledWith("card-1", "lab-work");
  });

  it("update_card removes labels from labels_remove", async () => {
    const context = makeContext();

    await updateCardTool.handler(context, { card_id: "card-1", labels_remove: ["Work"] });

    expect(vi.mocked(context.client.removeCardLabel)).toHaveBeenCalledWith("card-1", "lab-work");
  });

  it("update_card clears custom field when priority is null", async () => {
    const context = makeContext();

    await updateCardTool.handler(context, { card_id: "card-1", priority: null });

    expect(vi.mocked(context.client.clearCustomFieldValue)).toHaveBeenCalledWith("card-1", "cfg-1", "cf-priority");
  });

  it("update_card error path returns toolError payload", async () => {
    const context = makeContext();
    vi.mocked(context.client.getCard).mockRejectedValueOnce(new Error("boom"));

    const result = await updateCardTool.handler(context, { card_id: "card-1" });
    const payload = JSON.parse(result.content[0].text) as { error: string };

    expect(payload.error).toContain("boom");
  });
});
