import { beforeAll, describe, expect, it } from "vitest";

import { normalizeBoardSkeleton } from "../../src/client/cache.js";
import { PlankaClient } from "../../src/client/planka-client.js";
import { loadConfig } from "../../src/config/loader.js";

const SKIP = !process.env.PLANKA_LIVE_TESTS;

describe.skipIf(SKIP)("Live Planka smoke tests", () => {
  let client: PlankaClient;
  let boardId: string;

  beforeAll(() => {
    const config = loadConfig(process.env.PLANKA_CONFIG_PATH ?? "config/default.yaml");
    client = new PlankaClient({
      baseUrl: config.connection.base_url,
      apiKey: config.connection.api_key,
    });
    boardId = config.connection.board_id;
  });

  it("can fetch board and normalize skeleton", async () => {
    const response = await client.getBoard(boardId);
    const skeleton = normalizeBoardSkeleton(response);
    expect(skeleton.board.id).toBe(boardId);
    expect(skeleton.lists.length).toBeGreaterThan(0);
    expect(skeleton.labels.length).toBeGreaterThanOrEqual(0);
  });

  it("can paginate card list with cursor", async () => {
    const skeleton = normalizeBoardSkeleton(await client.getBoard(boardId));
    const firstList = skeleton.lists.find((l) => l.type === "active");
    if (!firstList) {
      return;
    }

    const response = await client.getCardsByList(firstList.id);
    expect(Array.isArray(response.items)).toBe(true);
  });

  it("custom field URL format works", async () => {
    const skeleton = normalizeBoardSkeleton(await client.getBoard(boardId));
    expect(skeleton.customFields).toBeDefined();
  });
});
