import { beforeAll, describe, expect, it } from "vitest";

import { normalizeBoardSkeleton, BoardSkeletonCache } from "../../src/client/cache.js";
import { PlankaClient } from "../../src/client/planka-client.js";
import { NameResolver } from "../../src/client/resolver.js";
import { loadConfig } from "../../src/config/loader.js";
import type { PlankaConfig } from "../../src/config/types.js";
import type { ToolContext } from "../../src/tools/core/shared.js";
import { createLogger } from "../../src/utils/logger.js";
import { buildToolContext } from "../../src/tools/generator.js";

// Import all tool handlers
import { boardOverviewHandler } from "../../src/tools/core/board-overview.js";
import { listCardsTool } from "../../src/tools/core/list-cards.js";
import { getCardTool } from "../../src/tools/core/get-card.js";
import { searchCardsTool } from "../../src/tools/core/search-cards.js";
import { dailySummaryTool } from "../../src/tools/core/daily-summary.js";
import { overdueCheckTool } from "../../src/tools/core/overdue-check.js";
import { searchArchiveTool } from "../../src/tools/core/search-archive.js";
import { sortListTool } from "../../src/tools/core/sort-list.js";
import { stopwatchTool } from "../../src/tools/core/stopwatch.js";

const SKIP = !process.env.PLANKA_LIVE_TESTS;

/**
 * Parse the JSON text from a tool result content array.
 */
function parseResult(result: { content: Array<{ type: string; text: string }> }): unknown {
  const text = result.content[0]?.text;
  expect(text).toBeDefined();
  return JSON.parse(text);
}

describe.skipIf(SKIP)("Live Planka smoke tests", () => {
  let config: PlankaConfig;
  let client: PlankaClient;
  let cache: BoardSkeletonCache;
  let logger: ReturnType<typeof createLogger>;
  let boardId: string;
  let ctx: ToolContext;

  beforeAll(async () => {
    config = loadConfig(process.env.PLANKA_CONFIG_PATH ?? "config/default.yaml");
    logger = createLogger("live-test");
    client = new PlankaClient({
      baseUrl: config.connection.base_url,
      apiKey: config.connection.api_key,
      logger,
    });
    cache = new BoardSkeletonCache(config.cache.skeleton_ttl_seconds * 1000);
    boardId = config.connection.board_id;

    // Build context once — this also preloads and caches the skeleton
    ctx = await buildToolContext(config, client as unknown as ToolContext["client"], cache, logger);
  });

  // ─── Foundation: board fetch + skeleton ───────────────────────────────────

  it("fetches board and normalizes skeleton without crashing", async () => {
    const response = await client.getBoard(boardId);
    const skeleton = normalizeBoardSkeleton(response);
    expect(skeleton.board.id).toBe(boardId);
    expect(skeleton.lists.length).toBeGreaterThan(0);

    // Verify labels with null names don't break normalization
    for (const label of skeleton.labels) {
      // name can be null (color-only labels) — that's fine
      expect(label.id).toBeTruthy();
    }

    // Verify cards with null stopwatch don't break normalization
    for (const card of skeleton.cards) {
      // stopwatch can be null — that's fine
      if (card.stopwatch) {
        expect(typeof card.stopwatch.total).toBe("number");
      }
    }
  });

  it("resolves known list names without crashing", () => {
    // These should all resolve without throwing
    expect(() => ctx.resolver.resolveListId("INBOX")).not.toThrow();
    expect(() => ctx.resolver.resolveListId("BACKLOG")).not.toThrow();
    expect(() => ctx.resolver.resolveDoneListId()).not.toThrow();
    expect(() => ctx.resolver.resolveBlockedListId()).not.toThrow();
  });

  // ─── board_overview ───────────────────────────────────────────────────────

  it("board_overview returns valid board data", async () => {
    const result = await boardOverviewHandler({}, ctx);
    const data = parseResult(result) as Record<string, unknown>;

    expect(data.board).toBeTruthy();
    expect(Array.isArray(data.lists)).toBe(true);
    expect(typeof data.total_cards).toBe("number");
    expect(typeof data.overdue_count).toBe("number");

    // Should not contain error
    expect(data).not.toHaveProperty("error");
  });

  // ─── list_cards ───────────────────────────────────────────────────────────

  it("list_cards INBOX returns without error", async () => {
    const result = await listCardsTool.handler(ctx, { list: "INBOX" });
    const data = parseResult(result) as Record<string, unknown>;

    expect(data).not.toHaveProperty("error");
    expect(typeof data.total).toBe("number");
    expect(Array.isArray(data.cards)).toBe(true);
  });

  it("list_cards BACKLOG returns without error", async () => {
    const result = await listCardsTool.handler(ctx, { list: "BACKLOG" });
    const data = parseResult(result) as Record<string, unknown>;

    expect(data).not.toHaveProperty("error");
    expect(typeof data.total).toBe("number");
  });

  it("list_cards handles every active list without crashing", async () => {
    const skeleton = normalizeBoardSkeleton(await client.getBoard(boardId));
    const activeLists = skeleton.lists.filter((l) => l.type === "active" && l.name);

    for (const list of activeLists) {
      const result = await listCardsTool.handler(ctx, { list: list.name as string });
      const data = parseResult(result) as Record<string, unknown>;
      // Must not error — cards with null stopwatch/labels should all be handled
      expect(data).not.toHaveProperty("error");
    }
  });

  // ─── get_card ─────────────────────────────────────────────────────────────

  it("get_card works for a real card (first card from any list)", async () => {
    const skeleton = normalizeBoardSkeleton(await client.getBoard(boardId));
    const firstCard = skeleton.cards[0];
    if (!firstCard) return; // no cards on board

    const result = await getCardTool.handler(ctx, { card_id: firstCard.id });
    const data = parseResult(result) as Record<string, unknown>;
    expect(data).not.toHaveProperty("error");
  });

  it("get_card handles card with null stopwatch gracefully", async () => {
    const skeleton = normalizeBoardSkeleton(await client.getBoard(boardId));
    // Find a card with null stopwatch (most cards)
    const cardWithNullSw = skeleton.cards.find((c) => c.stopwatch === null);
    if (!cardWithNullSw) return; // all cards have stopwatch data, skip

    const result = await getCardTool.handler(ctx, { card_id: cardWithNullSw.id });
    const data = parseResult(result) as Record<string, unknown>;
    expect(data).not.toHaveProperty("error");
  });

  // ─── search_cards ─────────────────────────────────────────────────────────

  it("search_cards without query returns all cards", async () => {
    const result = await searchCardsTool.handler(ctx, {});
    const data = parseResult(result) as Record<string, unknown>;

    expect(data).not.toHaveProperty("error");
    expect(typeof data.total).toBe("number");
    expect(Array.isArray(data.cards)).toBe(true);
  });

  it("search_cards with overdue filter", async () => {
    const result = await searchCardsTool.handler(ctx, { overdue: true });
    const data = parseResult(result) as Record<string, unknown>;

    expect(data).not.toHaveProperty("error");
    const cards = data.cards as Array<{ overdue: boolean }>;
    for (const card of cards) {
      expect(card.overdue).toBe(true);
    }
  });

  // ─── daily_summary ────────────────────────────────────────────────────────

  it("daily_summary returns structured summary", async () => {
    const result = await dailySummaryTool.handler(ctx, {});
    const data = parseResult(result) as Record<string, unknown>;

    expect(data).not.toHaveProperty("error");
    expect(data).toHaveProperty("today");
    expect(data).toHaveProperty("overdue");
    expect(data).toHaveProperty("inbox");
  });

  // ─── overdue_check ────────────────────────────────────────────────────────

  it("overdue_check returns without error", async () => {
    const result = await overdueCheckTool.handler(ctx, {});
    const data = parseResult(result) as Record<string, unknown>;

    expect(data).not.toHaveProperty("error");
  });

  // ─── search_archive ───────────────────────────────────────────────────────

  it("search_archive returns without error (may have no archive list)", async () => {
    const result = await searchArchiveTool.handler(ctx, {});
    const data = parseResult(result) as Record<string, unknown>;

    // May error if no archive list detected — that's a known limitation
    // But it should NOT crash with a null reference
    expect(result.content[0]?.text).toBeTruthy();
  });

  // ─── sort_list ────────────────────────────────────────────────────────────

  it("sort_list on BACKLOG returns without error", async () => {
    const result = await sortListTool.handler(ctx, { list_name: "BACKLOG" });
    const data = parseResult(result) as Record<string, unknown>;

    expect(data).not.toHaveProperty("error");
    expect(data).toHaveProperty("sorted_by");
    expect(data).toHaveProperty("card_count");
  });

  // ─── stopwatch (status only — non-mutating) ──────────────────────────────

  it("stopwatch status on a real card returns without error", async () => {
    const skeleton = normalizeBoardSkeleton(await client.getBoard(boardId));
    const firstCard = skeleton.cards[0];
    if (!firstCard) return;

    const result = await stopwatchTool.handler(ctx, { card_id: firstCard.id, action: "status" });
    const data = parseResult(result) as Record<string, unknown>;

    // Should return stopwatch data, not crash on null stopwatch
    expect(data).not.toHaveProperty("error");
    expect(data).toHaveProperty("stopwatch");
  });

  // ─── Null safety: iterate all cards and shape them ────────────────────────

  it("all cards on board can be shaped to T1 without crashing", async () => {
    const skeleton = normalizeBoardSkeleton(await client.getBoard(boardId));
    const activeLists = skeleton.lists.filter((l) => l.type === "active" || l.type === "closed");

    let totalCards = 0;
    for (const list of activeLists) {
      if (!list.name) continue;
      const result = await listCardsTool.handler(ctx, { list: list.name as string });
      const data = parseResult(result) as { cards: unknown[]; total: number };

      if (data.error) {
        // Log which list failed for debugging
        throw new Error(`list_cards failed for list "${list.name}": ${JSON.stringify(data)}`);
      }
      totalCards += data.total;
    }

    // If we got here, all cards on the board were shaped successfully
    expect(totalCards).toBeGreaterThanOrEqual(0);
  });
});
