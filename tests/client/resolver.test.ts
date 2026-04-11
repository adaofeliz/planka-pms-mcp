import { describe, expect, it } from "vitest";

import type { PlankaConfig } from "../../src/config/types.js";
import { AmbiguousMatchError, ConfigError, NotFoundError } from "../../src/utils/errors.js";
import { NameResolver } from "../../src/client/resolver.js";
import type { BoardSkeleton } from "../../src/client/cache.js";

function createConfig(overrides?: Partial<PlankaConfig["board"]["lists"]>): PlankaConfig {
  return {
    connection: {
      base_url: "https://planka.example.com",
      api_key: "k",
      board_id: "board-1",
    },
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
        ...overrides,
      },
      wip_limits: {},
      transitions: {},
      default_capture_list: "inbox",
      sort_rules: {},
      archive: {
        never_delete_done: true,
        search_enabled: true,
        page_size: 50,
      },
      due_date_windows: {
        approaching: { min_hours: 24, max_hours: 72 },
        imminent: { max_hours: 24 },
      },
    },
    labels: {
      categories: { domain: [], source: [], type: [] },
      required_on_triage: [],
    },
    custom_fields: {
      priority: {
        field_name: "Priority",
        type: "number",
        show_in_summary: true,
        required_on_triage: true,
      },
      duration: {
        field_name: "Duration (min)",
        type: "number",
        show_in_summary: true,
        required_on_triage: true,
      },
      scheduled: {
        field_name: "Scheduled",
        type: "datetime",
        show_in_summary: false,
        required_on_triage: false,
      },
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
    response: {
      tier1: ["id"],
      tier2_additions: ["description"],
      tier3_additions: ["comments"],
    },
    tools: {
      generate: [],
    },
    cache: {
      skeleton_ttl_seconds: 300,
      preload: true,
    },
  };
}

function createSkeleton(): BoardSkeleton {
  return {
    board: { id: "board-1", name: "Main", defaultCardType: "project" },
    lists: [
      { id: "l-inbox", createdAt: "", updatedAt: "", name: "📩 INBOX", position: 1, color: null, type: "active", boardId: "board-1" },
      { id: "l-backlog", createdAt: "", updatedAt: "", name: "➡️ BACKLOG", position: 2, color: null, type: "active", boardId: "board-1" },
      { id: "l-today", createdAt: "", updatedAt: "", name: "🔥 TODAY", position: 3, color: null, type: "active", boardId: "board-1" },
      { id: "l-blocked", createdAt: "", updatedAt: "", name: "⛔ BLOCKED", position: 4, color: null, type: "active", boardId: "board-1" },
      { id: "l-done", createdAt: "", updatedAt: "", name: "✅ DONE", position: 5, color: null, type: "closed", boardId: "board-1" },
      { id: "l-archive", createdAt: "", updatedAt: "", name: "Archive", position: 6, color: null, type: "archive", boardId: "board-1" },
    ],
    labels: [
      { id: "lab-work", name: "Work", color: "blue", position: 1, boardId: "board-1" },
      { id: "lab-focus", name: "Type: FOCUS", color: "red", position: 2, boardId: "board-1" },
    ],
    customFieldGroups: [{ id: "cfg-1", name: "Planning", boardId: "board-1" }],
    customFields: [
      { id: "cf-priority", name: "Priority", type: "number", position: 1 },
      { id: "cf-duration", name: "Duration (min)", type: "number", position: 2 },
    ],
    members: [
      { id: "u-1", name: "Alice Johnson", username: "alice", email: "alice@example.com" },
      { id: "u-2", name: "Alicia Johns", username: "alicia", email: "alicia@example.com" },
    ],
    cards: [],
    doneListId: "l-done",
    archiveListId: "l-archive",
  };
}

describe("NameResolver", () => {
  it("resolves exact list match", () => {
    const resolver = new NameResolver(createSkeleton(), createConfig());
    expect(resolver.resolveListId("BACKLOG")).toBe("l-backlog");
  });

  it("supports emoji-insensitive matching", () => {
    const resolver = new NameResolver(createSkeleton(), createConfig());
    expect(resolver.resolveListId("INBOX")).toBe("l-inbox");
  });

  it("returns typo suggestions when not found", () => {
    const resolver = new NameResolver(createSkeleton(), createConfig());
    expect(() => resolver.resolveListId("bakclog")).toThrowError(NotFoundError);

    try {
      resolver.resolveListId("bakclog");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
      const notFound = error as NotFoundError;
      expect(notFound.suggestions[0]).toContain("BACKLOG");
    }
  });

  it("throws explicit ambiguity error for closely tied matches", () => {
    const resolver = new NameResolver(createSkeleton(), createConfig());
    expect(() => resolver.resolveMemberId("Ali"))
      .toThrowError(AmbiguousMatchError);
  });

  it("throws ConfigError when semantic role mapping is missing", () => {
    const resolver = new NameResolver(createSkeleton(), createConfig({ today: undefined }));
    expect(() => resolver.resolveTodayListId()).toThrowError(ConfigError);
  });
});
