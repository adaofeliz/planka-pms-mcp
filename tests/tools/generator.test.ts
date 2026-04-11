import { describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { BoardSkeletonCache } from "../../src/client/cache.js";
import type { PlankaConfig } from "../../src/config/types.js";
import type { ToolContext } from "../../src/tools/core/shared.js";
import { createLogger } from "../../src/utils/logger.js";
import {
  buildToolContext,
  registerCoreTools,
  registerWorkflowTools,
  type CoreToolDefinition,
} from "../../src/tools/generator.js";

function createConfig(): PlankaConfig {
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

function createClient() {
  return {
    getBoard: vi.fn(async () => ({
      item: { id: "board-1", name: "Main", defaultCardType: "project" },
      included: {
        boardMemberships: [],
        labels: [],
        lists: [
          { id: "l-inbox", createdAt: "", updatedAt: "", name: "INBOX", position: 1, color: null, type: "active", boardId: "board-1" },
          { id: "l-backlog", createdAt: "", updatedAt: "", name: "BACKLOG", position: 2, color: null, type: "active", boardId: "board-1" },
          { id: "l-today", createdAt: "", updatedAt: "", name: "TODAY", position: 3, color: null, type: "active", boardId: "board-1" },
          { id: "l-active", createdAt: "", updatedAt: "", name: "ACTIVE", position: 4, color: null, type: "active", boardId: "board-1" },
          { id: "l-noise", createdAt: "", updatedAt: "", name: "NOISE", position: 5, color: null, type: "active", boardId: "board-1" },
          { id: "l-done", createdAt: "", updatedAt: "", name: "DONE", position: 6, color: null, type: "closed", boardId: "board-1" },
          { id: "l-archive", createdAt: "", updatedAt: "", name: "Archive", position: 7, color: null, type: "archive", boardId: "board-1" },
        ],
        cards: [],
        cardMemberships: [],
        cardLabels: [],
        taskLists: [],
        tasks: [],
        customFieldGroups: [],
        customFields: [],
        customFieldValues: [],
        users: [],
        projects: [],
        attachments: [],
      },
    })),
  };
}

function createWorkflowConfig(): PlankaConfig {
  return {
    ...createConfig(),
    board: {
      ...createConfig().board,
      wip_limits: { noise: 1 },
      transitions: {
        inbox: ["backlog", "today", "active", "noise"],
        backlog: ["today", "active", "noise", "done"],
        noise: ["backlog", "today", "active", "done"],
        today: ["active", "backlog", "noise", "done"],
        active: ["done", "today", "backlog", "noise"],
        blocked: ["backlog", "today", "active"],
        calendar: ["today", "active", "done"],
        done: [],
      },
    },
    tools: {
      generate: [
        {
          name: "triage_card",
          description: "Move card from INBOX and set metadata",
          composed_of: ["move_card", "update_card"],
          required_params: ["target_list", "domain_label", "type_label", "priority", "duration_min", "due_date"],
        },
        {
          name: "schedule_for_today",
          description: "Move to TODAY",
          composed_of: ["move_card"],
        },
        {
          name: "start_working",
          description: "Move to ACTIVE and start stopwatch",
          composed_of: ["move_card", "start_stopwatch"],
        },
        {
          name: "park_as_noise",
          description: "Park in NOISE",
          composed_of: ["move_card"],
        },
      ],
    },
    labels: {
      categories: {
        domain: ["Work"],
        source: [],
        type: ["Type: FOCUS"],
      },
      required_on_triage: [],
    },
  };
}

describe("tool generator", () => {
  it("registerCoreTools throws on duplicate tool names", () => {
    const server = { registerTool: vi.fn() } as unknown as McpServer;
    const config = createConfig();
    const cache = new BoardSkeletonCache(300_000);
    const client = createClient() as unknown as ToolContext["client"];

    const tools: CoreToolDefinition[] = [
      {
        name: "dup",
        description: "one",
        inputSchema: {},
        annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false },
        handler: async () => ({ content: [{ type: "text", text: "1" }] }),
      },
      {
        name: "dup",
        description: "two",
        inputSchema: {},
        annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false },
        handler: async () => ({ content: [{ type: "text", text: "2" }] }),
      },
    ];

    expect(() => registerCoreTools(server, tools, config, client, cache, createLogger("test"))).toThrow(
      /Duplicate tool name: dup/,
    );
  });

  it("registerCoreTools registers all tools", () => {
    const registerTool = vi.fn();
    const server = { registerTool } as unknown as McpServer;
    const config = createConfig();
    const cache = new BoardSkeletonCache(300_000);
    const client = createClient() as unknown as ToolContext["client"];

    const tools: CoreToolDefinition[] = [
      {
        name: "a_tool",
        description: "A",
        inputSchema: {},
        annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false },
        handler: async () => ({ content: [{ type: "text", text: "a" }] }),
      },
      {
        name: "b_tool",
        description: "B",
        inputSchema: {},
        annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false },
        handler: async () => ({ content: [{ type: "text", text: "b" }] }),
      },
    ];

    registerCoreTools(server, tools, config, client, cache, createLogger("test"));
    expect(registerTool).toHaveBeenCalledTimes(2);
  });

  it("buildToolContext returns context with resolver", async () => {
    const config = createConfig();
    const cache = new BoardSkeletonCache(300_000);
    const client = createClient() as unknown as ToolContext["client"];

    const context = await buildToolContext(config, client, cache, createLogger("test"));

    expect(context.resolver.resolveInboxListId()).toBe("l-inbox");
  });

  it("registered tool invokes handler with ToolContext", async () => {
    const registerTool = vi.fn();
    const server = { registerTool } as unknown as McpServer;
    const config = createConfig();
    const cache = new BoardSkeletonCache(300_000);
    const client = createClient() as unknown as ToolContext["client"];
    const handlerSpy = vi.fn(async (_ctx: ToolContext, _input: Record<string, unknown>) => ({
      content: [{ type: "text" as const, text: "ok" }],
    }));
    const handler: CoreToolDefinition["handler"] = handlerSpy;

    registerCoreTools(
      server,
      [
        {
          name: "bound",
          description: "Bound",
          inputSchema: {},
          annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false },
          handler,
        },
      ],
      config,
      client,
      cache,
      createLogger("test"),
    );

    const registeredHandler = registerTool.mock.calls[0][2] as (
      params: Record<string, unknown>,
    ) => Promise<{ content: Array<{ type: "text"; text: string }> }>;

    await registeredHandler({ card_id: "x" });

    expect(handlerSpy).toHaveBeenCalledTimes(1);
    const contextArg = handlerSpy.mock.calls[0]?.[0] as unknown as ToolContext;
    expect(contextArg.resolver).toBeDefined();
    expect(contextArg.config.connection.board_id).toBe("board-1");
  });
});

describe("workflow generator", () => {
  it("park_as_noise returns error at NOISE WIP limit", async () => {
    const config = createWorkflowConfig();
    config.board.wip_limits.noise = 0;
    const cache = new BoardSkeletonCache(300_000);
    const registerTool = vi.fn();
    const server = { registerTool } as unknown as McpServer;

    const client = {
      ...createClient(),
      moveCard: vi.fn(async () => ({ item: { id: "c-1" } })),
      sortList: vi.fn(async () => ({ items: [] })),
      getCard: vi.fn(async () => ({
        item: {
          id: "c-1",
          createdAt: "",
          updatedAt: "",
          type: "project" as const,
          position: 1,
          name: "Card",
          description: null,
          dueDate: null,
          isDueCompleted: false,
          stopwatch: { total: 0, startedAt: null },
          commentsTotal: 0,
          isClosed: false,
          listChangedAt: "",
          boardId: "board-1",
          listId: "l-inbox",
          creatorUserId: "u-1",
          prevListId: null,
          coverAttachmentId: null,
          isSubscribed: false,
        },
        included: { taskLists: [], tasks: [], cardLabels: [], cardMemberships: [], attachments: [], customFieldGroups: [], customFields: [], customFieldValues: [] },
      })),
    } as unknown as ToolContext["client"];

    registerWorkflowTools(server, config, client, cache, createLogger("test"));
    const parkHandler = registerTool.mock.calls.find((call) => call[0] === "park_as_noise")?.[2] as (
      input: Record<string, unknown>,
    ) => Promise<{ content: Array<{ type: "text"; text: string }> }>;

    const result = await parkHandler({ card_id: "c-1" });
    const payload = JSON.parse(result.content[0].text) as { error: string };
    expect(payload.error).toContain("WIP limit reached");
  });

  it("triage_card executes move, labels and custom fields", async () => {
    const config = createWorkflowConfig();
    config.board.wip_limits.noise = 5;
    const cache = new BoardSkeletonCache(300_000);
    const registerTool = vi.fn();
    const server = { registerTool } as unknown as McpServer;

    const client = {
      ...createClient(),
      moveCard: vi.fn(async () => ({ item: { id: "c-1" } })),
      sortList: vi.fn(async () => ({ items: [] })),
      addCardLabel: vi.fn(async () => {}),
      setCustomFieldValue: vi.fn(async () => {}),
      updateCard: vi.fn(async () => ({ item: { id: "c-1" } })),
      getCard: vi.fn(async () => ({
        item: {
          id: "c-1",
          createdAt: "",
          updatedAt: "",
          type: "project" as const,
          position: 1,
          name: "Card",
          description: null,
          dueDate: null,
          isDueCompleted: false,
          stopwatch: { total: 0, startedAt: null },
          commentsTotal: 0,
          isClosed: false,
          listChangedAt: "",
          boardId: "board-1",
          listId: "l-inbox",
          creatorUserId: "u-1",
          prevListId: null,
          coverAttachmentId: null,
          isSubscribed: false,
        },
        included: { taskLists: [], tasks: [], cardLabels: [], cardMemberships: [], attachments: [], customFieldGroups: [], customFields: [], customFieldValues: [] },
      })),
      getBoard: vi.fn(async () => ({
        item: { id: "board-1", name: "Main", defaultCardType: "project" },
        included: {
          boardMemberships: [],
          labels: [
            { id: "lab-work", name: "Work", color: "blue", position: 1, boardId: "board-1" },
            { id: "lab-type", name: "Type: FOCUS", color: "green", position: 2, boardId: "board-1" },
          ],
          lists: [
            { id: "l-inbox", createdAt: "", updatedAt: "", name: "INBOX", position: 1, color: null, type: "active", boardId: "board-1" },
            { id: "l-backlog", createdAt: "", updatedAt: "", name: "BACKLOG", position: 2, color: null, type: "active", boardId: "board-1" },
            { id: "l-done", createdAt: "", updatedAt: "", name: "DONE", position: 3, color: null, type: "closed", boardId: "board-1" },
            { id: "l-archive", createdAt: "", updatedAt: "", name: "Archive", position: 4, color: null, type: "archive", boardId: "board-1" },
          ],
          cards: [],
          cardMemberships: [],
          cardLabels: [],
          taskLists: [],
          tasks: [],
          customFieldGroups: [{ id: "cfg-1", name: "Main", boardId: "board-1" }],
          customFields: [
            { id: "cf-priority", name: "Priority", type: "number", position: 1, customFieldGroupId: "cfg-1" },
            { id: "cf-duration", name: "Duration", type: "number", position: 2, customFieldGroupId: "cfg-1" },
          ],
          customFieldValues: [],
          users: [],
          projects: [],
          attachments: [],
        },
      })),
    } as unknown as ToolContext["client"];

    registerWorkflowTools(server, config, client, cache, createLogger("test"));
    const triageHandler = registerTool.mock.calls.find((call) => call[0] === "triage_card")?.[2] as (
      input: Record<string, unknown>,
    ) => Promise<{ content: Array<{ type: "text"; text: string }> }>;

    await triageHandler({
      card_id: "c-1",
      target_list: "BACKLOG",
      domain_label: "Work",
      type_label: "Type: FOCUS",
      priority: 2,
      duration_min: 30,
      due_date: "2026-01-10",
    });

    expect(vi.mocked(client.moveCard)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(client.addCardLabel)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(client.setCustomFieldValue)).toHaveBeenCalledTimes(2);
  });

  it("start_working moves card then starts stopwatch", async () => {
    const config = createWorkflowConfig();
    const cache = new BoardSkeletonCache(300_000);
    const registerTool = vi.fn();
    const server = { registerTool } as unknown as McpServer;

    const workflowClient = {
      ...createClient(),
      moveCard: vi.fn(async () => ({ item: { id: "c-1" } })),
      sortList: vi.fn(async () => ({ items: [] })),
      startStopwatch: vi.fn(async () => ({ item: { id: "c-1", stopwatch: { total: 10, startedAt: "2026-01-01T00:00:00.000Z" } } })),
      getCard: vi.fn(async () => ({
        item: {
          id: "c-1",
          createdAt: "",
          updatedAt: "",
          type: "project" as const,
          position: 1,
          name: "Card",
          description: null,
          dueDate: null,
          isDueCompleted: false,
          stopwatch: { total: 10, startedAt: null },
          commentsTotal: 0,
          isClosed: false,
          listChangedAt: "",
          boardId: "board-1",
          listId: "l-inbox",
          creatorUserId: "u-1",
          prevListId: null,
          coverAttachmentId: null,
          isSubscribed: false,
        },
        included: { taskLists: [], tasks: [], cardLabels: [], cardMemberships: [], attachments: [], customFieldGroups: [], customFields: [], customFieldValues: [] },
      })),
    };
    const client = workflowClient as unknown as ToolContext["client"];

    registerWorkflowTools(server, config, client, cache, createLogger("test"));
    const startHandler = registerTool.mock.calls.find((call) => call[0] === "start_working")?.[2] as (
      input: Record<string, unknown>,
    ) => Promise<{ content: Array<{ type: "text"; text: string }> }>;

    await startHandler({ card_id: "c-1" });

    expect(vi.mocked(workflowClient.moveCard)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(workflowClient.startStopwatch)).toHaveBeenCalledTimes(1);
  });

  it("schedule_for_today moves card to TODAY list", async () => {
    const config = createWorkflowConfig();
    const cache = new BoardSkeletonCache(300_000);
    const registerTool = vi.fn();
    const server = { registerTool } as unknown as McpServer;

    const client = {
      ...createClient(),
      moveCard: vi.fn(async () => ({ item: { id: "c-1" } })),
      sortList: vi.fn(async () => ({ items: [] })),
      getCard: vi.fn(async () => ({
        item: {
          id: "c-1",
          createdAt: "",
          updatedAt: "",
          type: "project" as const,
          position: 1,
          name: "Card",
          description: null,
          dueDate: null,
          isDueCompleted: false,
          stopwatch: { total: 0, startedAt: null },
          commentsTotal: 0,
          isClosed: false,
          listChangedAt: "",
          boardId: "board-1",
          listId: "l-inbox",
          creatorUserId: "u-1",
          prevListId: null,
          coverAttachmentId: null,
          isSubscribed: false,
        },
        included: { taskLists: [], tasks: [], cardLabels: [], cardMemberships: [], attachments: [], customFieldGroups: [], customFields: [], customFieldValues: [] },
      })),
    } as unknown as ToolContext["client"];

    registerWorkflowTools(server, config, client, cache, createLogger("test"));
    const scheduleHandler = registerTool.mock.calls.find((call) => call[0] === "schedule_for_today")?.[2] as (
      input: Record<string, unknown>,
    ) => Promise<{ content: Array<{ type: "text"; text: string }> }>;

    await scheduleHandler({ card_id: "c-1" });

    const moveArgs = vi.mocked(client.moveCard).mock.calls[0];
    expect(moveArgs[1]).toBe("l-today");
  });
});
