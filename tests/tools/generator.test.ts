import { describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { BoardSkeletonCache } from "../../src/client/cache.js";
import type { PlankaConfig } from "../../src/config/types.js";
import type { ToolContext } from "../../src/tools/core/shared.js";
import { createLogger } from "../../src/utils/logger.js";
import {
  buildToolContext,
  registerCoreTools,
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
          { id: "l-done", createdAt: "", updatedAt: "", name: "DONE", position: 2, color: null, type: "closed", boardId: "board-1" },
          { id: "l-archive", createdAt: "", updatedAt: "", name: "Archive", position: 3, color: null, type: "archive", boardId: "board-1" },
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
