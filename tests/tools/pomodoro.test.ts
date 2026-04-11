import { describe, expect, it, vi } from "vitest";

import { PomodoroTracker } from "../../src/scheduling/pomodoro.js";
import { pomodoroTool } from "../../src/tools/core/pomodoro.js";
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
    pomodoro: {
      work_interval_minutes: 30,
      rest_interval_minutes: 10,
      intervals_before_long_rest: 4,
      long_rest_minutes: 30,
    },
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
    lists: [{ id: "l-inbox", createdAt: "", updatedAt: "", name: "INBOX", position: 1, color: null, type: "active", boardId: "board-1" }],
    labels: [],
    cardLabels: [],
    customFieldGroups: [],
    customFields: [],
    members: [],
    cards: [],
  };
}

function makeContext(): ToolContext {
  const cfg = config();
  const skel = skeleton();
  const cache = new BoardSkeletonCache(300_000);
  cache.set(cfg.connection.board_id, skel);
  const resolver = new NameResolver(skel, cfg);

  const card = {
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
      stopwatch: { total: 120, startedAt: null as string | null },
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
      cardLabels: [],
      cardMemberships: [],
      attachments: [],
      customFieldGroups: [],
      customFields: [],
      customFieldValues: [],
    },
  };

  const client: ToolContext["client"] = {
    getBoard: vi.fn(async () => ({ item: skel.board, included: { boardMemberships: [], labels: [], lists: skel.lists, cards: [], cardMemberships: [], cardLabels: [], taskLists: [], tasks: [], customFieldGroups: [], customFields: [], customFieldValues: [], users: [], projects: [], attachments: [] } })),
    getBoardSkeleton: vi.fn(async () => skel),
    getCardsByList: vi.fn(async () => ({ items: [], included: { cardLabels: [], cardMemberships: [], taskLists: [], tasks: [], customFieldGroups: [], customFields: [], customFieldValues: [], users: [] } })),
    getCard: vi.fn(async () => card),
    getComments: vi.fn(async () => ({ items: [], included: { users: [] } })),
    getCardActions: vi.fn(async () => ({ items: [], included: { users: [] } })),
    createCard: vi.fn(async () => card),
    updateCard: vi.fn(async () => card),
    addCardLabel: vi.fn(async () => {}),
    removeCardLabel: vi.fn(async () => {}),
    setCustomFieldValue: vi.fn(async () => {}),
    clearCustomFieldValue: vi.fn(async () => {}),
    moveCard: vi.fn(async () => card),
    createComment: vi.fn(async () => ({ item: { id: "cm-1", cardId: "card-1", userId: "u-1", text: "x" } } as never)),
    archiveCard: vi.fn(async () => card),
    sortList: vi.fn(async () => ({})),
    startStopwatch: vi.fn(async () => ({ ...card, item: { ...card.item, stopwatch: { total: 120, startedAt: "2026-01-10T00:00:00.000Z" } } })),
    stopStopwatch: vi.fn(async () => ({ ...card, item: { ...card.item, stopwatch: { total: 180, startedAt: null } } })),
    resetStopwatch: vi.fn(async () => ({ ...card, item: { ...card.item, stopwatch: { total: 0, startedAt: null } } })),
    getStopwatchStatus: vi.fn((stopwatch) => ({ total: stopwatch.total, startedAt: stopwatch.startedAt, running: stopwatch.startedAt !== null, elapsed: stopwatch.startedAt ? 30 : 0, totalWithElapsed: stopwatch.total + (stopwatch.startedAt ? 30 : 0) })),
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

describe("pomodoro tracker", () => {
  it("tracks work/rest transitions and computes remaining time", () => {
    const tracker = new PomodoroTracker();
    const start = new Date("2026-01-10T10:00:00.000Z");
    const work = tracker.startWork("card-1", 30, start);
    const afterFive = new Date("2026-01-10T10:05:00.000Z");
    const remaining = tracker.computeRemaining(work, afterFive);

    expect(work.phase).toBe("work");
    expect(remaining.elapsed).toBe(300);
    expect(remaining.remaining).toBe(1500);

    const rest = tracker.startRest("card-1", 10, afterFive);
    expect(rest.phase).toBe("rest");
    expect(rest.sessionsToday).toBe(1);
  });

  it("resets sessions_today at day boundary and does not persist across instances", () => {
    const tracker = new PomodoroTracker();
    tracker.startWork("card-1", 25, new Date("2026-01-10T08:00:00.000Z"));
    const nextDayStatus = tracker.getStatus("card-1", new Date("2026-01-11T08:00:00.000Z"));
    expect(nextDayStatus?.sessionsToday).toBe(0);

    const freshTracker = new PomodoroTracker();
    expect(freshTracker.getStatus("card-1", new Date("2026-01-11T08:00:00.000Z"))).toBeNull();
  });
});

describe("pomodoro tool", () => {
  it("supports start_work/start_rest/status/stop and returns concise shape", async () => {
    const ctx = makeContext();

    const started = await pomodoroTool.handler(ctx, { card_id: "card-1", action: "start_work" });
    const startPayload = JSON.parse(started.content[0].text) as { pomodoro: { phase: string; interval: string; sessions_today: number } };
    expect(startPayload.pomodoro.phase).toBe("work");
    expect(startPayload.pomodoro.interval).toBe("30m");

    const status = await pomodoroTool.handler(ctx, { card_id: "card-1", action: "status" });
    const statusPayload = JSON.parse(status.content[0].text) as { pomodoro: { phase: string; elapsed: string; remaining: string } };
    expect(statusPayload.pomodoro.phase).toBe("work");

    const rest = await pomodoroTool.handler(ctx, { card_id: "card-1", action: "start_rest", rest_minutes: 5 });
    const restPayload = JSON.parse(rest.content[0].text) as { pomodoro: { phase: string; interval: string } };
    expect(restPayload.pomodoro.phase).toBe("rest");
    expect(restPayload.pomodoro.interval).toBe("5m");

    const stopped = await pomodoroTool.handler(ctx, { card_id: "card-1", action: "stop" });
    const stopPayload = JSON.parse(stopped.content[0].text) as { status: string };
    expect(stopPayload.status).toBe("stopped");
  });
});
