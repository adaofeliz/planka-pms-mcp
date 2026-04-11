import { describe, expect, it, vi } from "vitest";

import { PlankaClient } from "../../src/client/planka-client.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function createBoardPayload(boardId: string, suffix: string) {
  return {
    item: {
      id: boardId,
      name: `Board ${suffix}`,
      defaultCardType: "project",
    },
    included: {
      boardMemberships: [],
      labels: [{ id: `label-${suffix}`, name: `Label ${suffix}`, color: "blue", position: 1, boardId }],
      lists: [
        { id: `list-active-${suffix}`, createdAt: "", updatedAt: "", name: "ACTIVE", position: 1, color: null, type: "active", boardId },
        { id: `list-done-${suffix}`, createdAt: "", updatedAt: "", name: "DONE", position: 2, color: null, type: "closed", boardId },
        { id: `list-archive-${suffix}`, createdAt: "", updatedAt: "", name: "Archive", position: 3, color: null, type: "archive", boardId },
      ],
      cards: [],
      cardMemberships: [],
      cardLabels: [],
      taskLists: [],
      tasks: [],
      customFieldGroups: [],
      customFields: [],
      customFieldValues: [],
      users: [{ id: `user-${suffix}`, name: "Test", username: "test", email: "test@example.com" }],
      projects: [],
      attachments: [],
    },
  };
}

describe("board skeleton cache", () => {
  it("returns cached skeleton on repeated reads", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(createBoardPayload("board-1", "A")));

    const client = new PlankaClient({
      baseUrl: "https://planka.example.com",
      apiKey: "k",
      fetch: fetchMock as typeof fetch,
      boardSkeletonTtlMs: 60_000,
    });

    const first = await client.getBoardSkeleton("board-1");
    const second = await client.getBoardSkeleton("board-1");

    expect(first.board.name).toBe("Board A");
    expect(second.board.name).toBe("Board A");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("expires cache entries after TTL", async () => {
    const clock = vi.useFakeTimers();
    let call = 0;

    const fetchMock = vi.fn(async () => {
      call += 1;
      return jsonResponse(createBoardPayload("board-ttl", String(call)));
    });

    const client = new PlankaClient({
      baseUrl: "https://planka.example.com",
      apiKey: "k",
      fetch: fetchMock as typeof fetch,
      boardSkeletonTtlMs: 1_000,
    });

    const initial = await client.getBoardSkeleton("board-ttl");
    expect(initial.board.name).toBe("Board 1");

    await clock.advanceTimersByTimeAsync(1_100);

    const refreshed = await client.getBoardSkeleton("board-ttl");
    expect(refreshed.board.name).toBe("Board 2");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    clock.useRealTimers();
  });

  it("supports forced refresh", async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      return jsonResponse(createBoardPayload("board-force", String(call)));
    });

    const client = new PlankaClient({
      baseUrl: "https://planka.example.com",
      apiKey: "k",
      fetch: fetchMock as typeof fetch,
      boardSkeletonTtlMs: 60_000,
    });

    const first = await client.getBoardSkeleton("board-force");
    const forced = await client.getBoardSkeleton("board-force", true);

    expect(first.board.name).toBe("Board 1");
    expect(forced.board.name).toBe("Board 2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent preload and read requests", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;

    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const client = new PlankaClient({
      baseUrl: "https://planka.example.com",
      apiKey: "k",
      fetch: fetchMock as typeof fetch,
      boardSkeletonTtlMs: 60_000,
    });

    const preloadPromise = client.preloadBoardSkeleton("board-dedupe");
    const readPromise = client.getBoardSkeleton("board-dedupe");

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch?.(jsonResponse(createBoardPayload("board-dedupe", "X")));

    await preloadPromise;
    const skeleton = await readPromise;

    expect(skeleton.board.name).toBe("Board X");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
