import { describe, it, expect, vi } from "vitest";

import { boardOverviewHandler } from "../../src/tools/core/board-overview.js";
import type { ToolContext } from "../../src/tools/core/shared.js";

function buildMockContext(overrides?: Partial<ToolContext>): ToolContext {
  const minimalConfig = {
    connection: { base_url: "https://test.com", api_key: "key", board_id: "board1" },
    labels: { categories: { domain: ["Work", "Homelab"], source: [], type: [] }, required_on_triage: [] },
  } as unknown as import("../../src/config/types.js").PlankaConfig;

  return {
    config: minimalConfig,
    client: {
      getBoard: vi.fn().mockResolvedValue({
        item: { id: "board1", name: "Command Center", defaultCardType: "project" },
        included: {
          lists: [
            {
              id: "l1",
              name: "INBOX",
              type: "active",
              position: 1,
              boardId: "board1",
              createdAt: "",
              updatedAt: "",
              color: null,
            },
            {
              id: "l2",
              name: "DONE",
              type: "closed",
              position: 9,
              boardId: "board1",
              createdAt: "",
              updatedAt: "",
              color: null,
            },
            {
              id: "l3",
              name: "Archive",
              type: "archive",
              position: 10,
              boardId: "board1",
              createdAt: "",
              updatedAt: "",
              color: null,
            },
          ],
          cards: [
            {
              id: "c1",
              name: "Task 1",
              listId: "l1",
              dueDate: null,
              isDueCompleted: false,
              description: null,
              stopwatch: { total: 0, startedAt: null },
              createdAt: "",
              updatedAt: "",
              type: "project",
              position: 1,
              commentsTotal: 0,
              isClosed: false,
              listChangedAt: "",
              boardId: "board1",
              creatorUserId: "",
              prevListId: null,
              coverAttachmentId: null,
              isSubscribed: false,
            },
            {
              id: "c2",
              name: "Task 2",
              listId: "l1",
              dueDate: "2020-01-01T00:00:00Z",
              isDueCompleted: false,
              description: "has desc",
              stopwatch: { total: 0, startedAt: "2026-01-01T00:00:00Z" },
              createdAt: "",
              updatedAt: "",
              type: "project",
              position: 2,
              commentsTotal: 0,
              isClosed: false,
              listChangedAt: "",
              boardId: "board1",
              creatorUserId: "",
              prevListId: null,
              coverAttachmentId: null,
              isSubscribed: false,
            },
          ],
          labels: [{ id: "lbl1", name: "Work", color: "blue", position: 1, boardId: "board1" }],
          cardLabels: [{ id: "cl1", cardId: "c2", labelId: "lbl1" }],
          boardMemberships: [],
          cardMemberships: [],
          taskLists: [],
          tasks: [],
          customFieldGroups: [],
          customFields: [],
          customFieldValues: [],
          users: [],
          projects: [],
          attachments: [],
        },
      }),
    } as unknown as ToolContext["client"],
    cache: {
      get: vi.fn().mockReturnValue(undefined),
      set: vi.fn(),
      invalidate: vi.fn(),
    } as unknown as ToolContext["cache"],
    resolver: {} as ToolContext["resolver"],
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    ...overrides,
  };
}

describe("boardOverviewHandler", () => {
  it("returns board name, list counts, totals, overdue count, and labels summary", async () => {
    const ctx = buildMockContext();

    const result = await boardOverviewHandler({}, ctx);
    const payload = JSON.parse(result.content[0].text) as {
      board: string;
      lists: Array<{ name: string; count: number; type: string }>;
      total_cards: number;
      overdue_count: number;
      labels_summary: Record<string, number>;
    };

    expect(payload.board).toBe("Command Center");
    expect(payload.lists.some((list) => list.name === "INBOX" && list.count === 2)).toBe(true);
    expect(payload.lists.some((list) => list.name === "DONE" && list.count === 0)).toBe(true);
    expect(payload.lists.some((list) => list.name === "Archive")).toBe(false);
    expect(payload.total_cards).toBe(2);
    expect(payload.overdue_count).toBe(1);
    expect(payload.labels_summary).toEqual({ Work: 1 });
  });

  it("returns tool error payload when getBoard fails", async () => {
    const ctx = buildMockContext({
      client: {
        getBoard: vi.fn().mockRejectedValue(new Error("boom")),
      } as unknown as ToolContext["client"],
    });

    const result = await boardOverviewHandler({}, ctx);
    const payload = JSON.parse(result.content[0].text) as { error: string };

    expect(payload.error).toContain("boom");
  });
});
