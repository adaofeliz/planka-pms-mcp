import { describe, expect, it, vi } from "vitest";

import type { ToolContext } from "../../src/tools/core/shared.js";
import { createCardTool } from "../../src/tools/core/create-card.js";
import { updateCardTool } from "../../src/tools/core/update-card.js";
import { moveCardTool } from "../../src/tools/core/move-card.js";
import { completeCardTool } from "../../src/tools/core/complete-card.js";
import { blockCardTool } from "../../src/tools/core/block-card.js";
import { archiveCardTool } from "../../src/tools/core/archive-card.js";
import { NameResolver } from "../../src/client/resolver.js";
import { BoardSkeletonCache, type BoardSkeleton } from "../../src/client/cache.js";
import { createLogger } from "../../src/utils/logger.js";
import type { PlankaConfig } from "../../src/config/types.js";

function config(transitions: PlankaConfig["board"]["transitions"] = {}): PlankaConfig {
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
      transitions,
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
      { id: "l-blocked", createdAt: "", updatedAt: "", name: "BLOCKED", position: 4, color: null, type: "active", boardId: "board-1" },
      { id: "l-archive", createdAt: "", updatedAt: "", name: "Archive", position: 5, color: null, type: "archive", boardId: "board-1" },
    ],
    labels: [{ id: "lab-work", name: "Work", color: "blue", position: 1, boardId: "board-1" }],
    cardLabels: [],
    customFieldGroups: [{ id: "cfg-1", name: "Main", boardId: "board-1" }],
    customFields: [
      { id: "cf-priority", name: "Priority", type: "number", position: 1, customFieldGroupId: "cfg-1" },
      { id: "cf-duration", name: "Duration", type: "number", position: 2, customFieldGroupId: "cfg-1" },
    ],
    members: [],
    cards: [],
    doneListId: "l-done",
    archiveListId: "l-archive",
  };
}

function cardDetail(cardId = "card-1", listId = "l-inbox") {
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
      listId,
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
        { id: "v-1", content: "1", customFieldGroupId: "cfg-1", customFieldId: "cf-priority", cardId },
        { id: "v-2", content: "30", customFieldGroupId: "cfg-1", customFieldId: "cf-duration", cardId },
      ],
    },
  };
}

function makeContext(transitions: PlankaConfig["board"]["transitions"] = {}, initialListId = "l-inbox"): ToolContext {
  const cfg = config(transitions);
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
    getCard: vi
      .fn()
      .mockResolvedValueOnce(cardDetail("card-1", initialListId))
      .mockResolvedValueOnce(cardDetail("card-1", "l-backlog"))
      .mockResolvedValue(cardDetail("card-1", "l-backlog")),
    getComments: vi.fn(async () => ({ items: [], included: { users: [] } })),
    getCardActions: vi.fn(async () => ({ items: [], included: { users: [] } })),
    createCard: vi.fn(async () => cardDetail("card-1", initialListId)),
    updateCard: vi.fn(async () => cardDetail("card-1", initialListId)),
    addCardLabel: vi.fn(async () => {}),
    removeCardLabel: vi.fn(async () => {}),
    setCustomFieldValue: vi.fn(async () => {}),
    clearCustomFieldValue: vi.fn(async () => {}),
    moveCard: vi.fn(async (_cardId: string, targetListId: string) => cardDetail("card-1", targetListId)),
    createComment: vi.fn(async () => ({ item: { id: "comment-1" } } as never)),
    archiveCard: vi.fn(async (_cardId: string, targetListId: string) => cardDetail("card-1", targetListId)),
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

  it("create_card sends position 65535 for an empty list", async () => {
    const context = makeContext();
    await createCardTool.handler(context, { name: "New task" });
    expect(vi.mocked(context.client.createCard)).toHaveBeenCalledWith(
      "l-inbox",
      expect.objectContaining({ position: 65535 }),
    );
  });

  it("create_card sends position = max existing + 65535 for non-empty list", async () => {
    const context = makeContext();
    vi.mocked(context.client.getCardsByList).mockResolvedValueOnce({
      items: [
        { ...cardDetail("card-x").item, position: 65535 },
        { ...cardDetail("card-y").item, position: 131070 },
      ],
      included: { cardLabels: [], cardMemberships: [], taskLists: [], tasks: [], customFieldGroups: [], customFields: [], customFieldValues: [], users: [] },
    });
    await createCardTool.handler(context, { name: "Third card" });
    expect(vi.mocked(context.client.createCard)).toHaveBeenCalledWith(
      "l-inbox",
      expect.objectContaining({ position: 131070 + 65535 }),
    );
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
    context.client.getCard = vi.fn(async () => {
      throw new Error("boom");
    });
    const result = await updateCardTool.handler(context, { card_id: "card-1" });
    const payload = JSON.parse(result.content[0].text) as { error: string };
    expect(payload.error).toContain("boom");
  });

  it("move_card calls moveCard with resolved target list ID", async () => {
    const context = makeContext({ inbox: ["backlog"] });
    await moveCardTool.handler(context, { card_id: "card-1", target_list: "BACKLOG" });
    expect(vi.mocked(context.client.moveCard)).toHaveBeenCalledWith("card-1", "l-backlog", 1);
  });

  it("move_card returns informative error for invalid transition", async () => {
    const context = makeContext({ inbox: ["today"] });
    const result = await moveCardTool.handler(context, { card_id: "card-1", target_list: "BACKLOG" });
    const payload = JSON.parse(result.content[0].text) as { error: string; suggestions?: string[] };
    expect(payload.error).toContain("Cannot move card");
    expect(payload.suggestions).toContain("TODAY");
  });

  it("complete_card calls moveCard with DONE list ID", async () => {
    const context = makeContext();
    await completeCardTool.handler(context, { card_id: "card-1" });
    expect(vi.mocked(context.client.moveCard)).toHaveBeenCalledWith("card-1", "l-done");
  });

  it("complete_card returns completed_at timestamp", async () => {
    const context = makeContext();
    const result = await completeCardTool.handler(context, { card_id: "card-1" });
    const payload = JSON.parse(result.content[0].text) as { completed_at: string };
    expect(payload.completed_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("block_card moves card to BLOCKED and writes reason comment", async () => {
    const context = makeContext();
    await blockCardTool.handler(context, { card_id: "card-1", reason: "Waiting on API" });

    expect(vi.mocked(context.client.moveCard)).toHaveBeenCalledWith("card-1", "l-blocked");
    expect(vi.mocked(context.client.createComment)).toHaveBeenCalledWith("card-1", "🚫 BLOCKED: Waiting on API");
  });

  it("archive_card returns validation error when card is not in DONE", async () => {
    const context = makeContext();
    const result = await archiveCardTool.handler(context, { card_id: "card-1" });
    const payload = JSON.parse(result.content[0].text) as { error: string; suggestions?: string[] };

    expect(payload.error).toContain("Card must be in DONE");
    expect(payload.suggestions).toContain("Move the card to DONE first using complete_card");
  });

  it("archive_card calls archiveCard when card is in DONE", async () => {
    const context = makeContext({}, "l-done");
    await archiveCardTool.handler(context, { card_id: "card-1" });

    expect(vi.mocked(context.client.archiveCard)).toHaveBeenCalledWith("card-1", "l-archive");
  });
});
