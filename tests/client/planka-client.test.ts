import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlankaClient } from "../../src/client/planka-client.js";
import { ApiError } from "../../src/utils/errors.js";
import type { ActionsResponse, BoardResponse, CardsResponse, CommentsResponse } from "../../src/client/types.js";

function makeFetchMock(status: number, body: unknown): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  } as Response);
}

describe("PlankaClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const boardResponse: BoardResponse = {
    item: {
      id: "b1",
      name: "Board",
      defaultCardType: "project",
    },
    included: {
      boardMemberships: [],
      labels: [],
      lists: [],
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
  };

  const cardsResponse: CardsResponse = {
    items: [],
    included: {
      cardLabels: [],
      cardMemberships: [],
      taskLists: [],
      tasks: [],
      customFieldGroups: [],
      customFields: [],
      customFieldValues: [],
      users: [],
    },
  };

  const commentsResponse: CommentsResponse = {
    items: [],
    included: { users: [] },
  };

  const actionsResponse: ActionsResponse = {
    items: [],
    included: { users: [] },
  };

  it("normalizes base URL and avoids double slashes", async () => {
    const mockFetch = makeFetchMock(200, boardResponse);
    const client = new PlankaClient({
      baseUrl: "https://planka.example.com/",
      apiKey: "key",
      fetch: mockFetch,
    });

    await client.getBoard("b1");

    const [calledUrl] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain("/api/boards/b1");
    expect(calledUrl).not.toContain("//api");
  });

  it("injects X-Api-Key header", async () => {
    const mockFetch = makeFetchMock(200, boardResponse);

    const client = new PlankaClient({
      baseUrl: "https://planka.test",
      apiKey: "test-key-123",
      fetch: mockFetch,
    });

    await client.getBoard("board1");

    const [, calledInit] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((calledInit as RequestInit).headers).toMatchObject({ "X-Api-Key": "test-key-123" });
  });

  it("returns successful getBoard response", async () => {
    const mockFetch = makeFetchMock(200, boardResponse);
    const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

    const response = await client.getBoard("b1");
    expect(response).toEqual(boardResponse);
  });

  it("calls GET /api/lists/{listId}/cards with no options", async () => {
    const mockFetch = makeFetchMock(200, cardsResponse);
    const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

    await client.getCardsByList("list1");
    const [calledUrl, calledInit] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain("/api/lists/list1/cards");
    expect((calledInit as RequestInit).method).toBe("GET");
  });

  it("adds cursor pagination query params", async () => {
    const mockFetch = makeFetchMock(200, cardsResponse);
    const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

    await client.getCardsByList("list1", {
      before: {
        listChangedAt: "2026-01-01T00:00:00Z",
        id: "card123",
      },
    });

    const [calledUrl] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain("before%5BlistChangedAt%5D=2026-01-01T00%3A00%3A00Z");
    expect(calledUrl).toContain("before%5Bid%5D=card123");
  });

  it("adds search query param", async () => {
    const mockFetch = makeFetchMock(200, cardsResponse);
    const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

    await client.getCardsByList("list1", { search: "hello" });
    const [calledUrl] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain("search=hello");
  });

  it("adds comma-joined labelIds query param", async () => {
    const mockFetch = makeFetchMock(200, cardsResponse);
    const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

    await client.getCardsByList("list1", { labelIds: ["l1", "l2"] });
    const [calledUrl] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain("labelIds=l1%2Cl2");
  });

  it("maps 404 response to ApiError with statusCode", async () => {
    const mockFetch = makeFetchMock(404, { message: "Card not found" });
    const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

    await expect(client.getCard("missing")).rejects.toMatchObject({
      name: "ApiError",
      statusCode: 404,
    });
  });

  it("includes problems array from Planka 400 validation errors in message", async () => {
    const mockFetch = makeFetchMock(400, {
      code: "E_MISSING_OR_INVALID_PARAMS",
      problems: ['Invalid "dueDate": Cannot use `null`.'],
      message: "The server could not fulfill this request due to 1 missing or invalid parameter.",
    });
    const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

    await expect(client.getBoard("b1")).rejects.toThrow('Invalid "dueDate"');
  });

  it("maps 401 response to ApiError with statusCode", async () => {
    const mockFetch = makeFetchMock(401, { message: "Unauthorized" });
    const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

    await expect(client.getBoard("b1")).rejects.toBeInstanceOf(ApiError);
    await expect(client.getBoard("b1")).rejects.toMatchObject({ statusCode: 401 });
  });

  it("calls /api/cards/{cardId}/comments", async () => {
    const mockFetch = makeFetchMock(200, commentsResponse);
    const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

    await client.getComments("card1");
    const [calledUrl] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain("/api/cards/card1/comments");
  });

  it("calls /api/cards/{cardId}/actions", async () => {
    const mockFetch = makeFetchMock(200, actionsResponse);
    const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

    await client.getCardActions("card1");
    const [calledUrl] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain("/api/cards/card1/actions");
  });

  describe("write methods", () => {
    it("createCard calls POST /api/lists/{listId}/cards with project type", async () => {
      const mockFetch = makeFetchMock(200, { item: {}, included: {} });
      const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

      await client.createCard("list1", { type: "project", name: "Card Name" });

      const [calledUrl, calledInit] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(calledUrl).toContain("/api/lists/list1/cards");
      expect((calledInit as RequestInit).method).toBe("POST");
      expect(JSON.parse(((calledInit as RequestInit).body as string))).toMatchObject({
        type: "project",
        name: "Card Name",
      });
    });

    it("updateCard calls PATCH /api/cards/{cardId} with provided fields", async () => {
      const mockFetch = makeFetchMock(200, { item: {}, included: {} });
      const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

      await client.updateCard("card1", { name: "Updated", description: "Desc", isDueCompleted: true });

      const [calledUrl, calledInit] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(calledUrl).toContain("/api/cards/card1");
      expect((calledInit as RequestInit).method).toBe("PATCH");
      expect(JSON.parse(((calledInit as RequestInit).body as string))).toEqual({
        name: "Updated",
        description: "Desc",
        isDueCompleted: true,
      });
    });

    it("moveCard calls PATCH /api/cards/{cardId} with listId and optional position", async () => {
      const mockFetch = makeFetchMock(200, { item: {}, included: {} });
      const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

      await client.moveCard("card1", "list2");
      await client.moveCard("card1", "list3", 42);

      const firstCall = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const secondCall = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[1];

      expect(firstCall[0]).toContain("/api/cards/card1");
      expect((firstCall[1] as RequestInit).method).toBe("PATCH");
      expect(JSON.parse(((firstCall[1] as RequestInit).body as string))).toEqual({ listId: "list2" });

      expect(JSON.parse(((secondCall[1] as RequestInit).body as string))).toEqual({
        listId: "list3",
        position: 42,
      });
    });

    it("addCardLabel calls POST /api/cards/{cardId}/card-labels with labelId", async () => {
      const mockFetch = makeFetchMock(200, {});
      const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

      await client.addCardLabel("card1", "label1");

      const [calledUrl, calledInit] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(calledUrl).toContain("/api/cards/card1/card-labels");
      expect((calledInit as RequestInit).method).toBe("POST");
      expect(JSON.parse(((calledInit as RequestInit).body as string))).toEqual({ labelId: "label1" });
    });

    it("createComment calls POST /api/cards/{cardId}/comments with text", async () => {
      const mockFetch = makeFetchMock(200, { item: {}, included: { users: [] } });
      const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

      await client.createComment("card1", "hello");

      const [calledUrl, calledInit] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(calledUrl).toContain("/api/cards/card1/comments");
      expect((calledInit as RequestInit).method).toBe("POST");
      expect(JSON.parse(((calledInit as RequestInit).body as string))).toEqual({ text: "hello" });
    });

    it("setCustomFieldValue uses single-colon custom field route format", async () => {
      const mockFetch = makeFetchMock(200, {});
      const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

      await client.setCustomFieldValue("card1", "grp1", "fld1", "5");

      const [calledUrl, calledInit] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(calledUrl).toContain("/custom-field-values/customFieldGroupId:grp1:customFieldId:fld1");
      expect((calledInit as RequestInit).method).toBe("PATCH");
    });

    it("clearCustomFieldValue calls DELETE on correct single-colon URL", async () => {
      const mockFetch = makeFetchMock(200, {});
      const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

      await client.clearCustomFieldValue("card1", "grp1", "fld1");

      const [calledUrl, calledInit] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(calledUrl).toContain("customFieldGroupId:grp1:customFieldId:fld1");
      expect((calledInit as RequestInit).method).toBe("DELETE");
    });

    it("sortList calls POST /api/lists/{listId}/sort with field and order", async () => {
      const mockFetch = makeFetchMock(200, { items: [], included: {} });
      const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

      await client.sortList("list1", "dueDate", "asc");

      const [calledUrl, calledInit] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(calledUrl).toContain("/api/lists/list1/sort");
      expect((calledInit as RequestInit).method).toBe("POST");
      expect(JSON.parse(((calledInit as RequestInit).body as string))).toEqual({
        fieldName: "dueDate",
        order: "asc",
      });
    });

    it("startStopwatch sets startedAt and preserves total", async () => {
      const capturedBodies: unknown[] = [];
      const mockFetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.body) capturedBodies.push(JSON.parse(init.body as string));
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ item: {}, included: {} }),
        } as Response);
      });
      const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

      await client.startStopwatch("card1", 300);

      const body = capturedBodies[0] as { stopwatch: { total: number; startedAt: string } };
      expect(body.stopwatch.total).toBe(300);
      expect(typeof body.stopwatch.startedAt).toBe("string");
      expect(body.stopwatch.startedAt.startsWith("202")).toBe(true);
    });

    it("stopStopwatch computes elapsed correctly", async () => {
      const capturedBodies: unknown[] = [];
      const mockFetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.body) capturedBodies.push(JSON.parse(init.body as string));
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ item: {}, included: {} }),
        } as Response);
      });
      const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

      const startedAt = new Date(Date.now() - 60_000).toISOString();
      await client.stopStopwatch("card1", 100, startedAt);

      const body = capturedBodies[0] as { stopwatch: { total: number } };
      expect(body.stopwatch.total).toBeGreaterThanOrEqual(159);
      expect(body.stopwatch.total).toBeLessThanOrEqual(162);
    });

    it("resetStopwatch sets total 0 and startedAt null", async () => {
      const capturedBodies: unknown[] = [];
      const mockFetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.body) capturedBodies.push(JSON.parse(init.body as string));
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ item: {}, included: {} }),
        } as Response);
      });
      const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: mockFetch });

      await client.resetStopwatch("card1");

      const body = capturedBodies[0] as { stopwatch: { total: number; startedAt: string | null } };
      expect(body.stopwatch).toEqual({ total: 0, startedAt: null });
    });

    it("getStopwatchStatus returns running stopwatch details", () => {
      const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: makeFetchMock(200, {}) });

      const status = client.getStopwatchStatus({
        total: 0,
        startedAt: new Date(Date.now() - 5_000).toISOString(),
      });

      expect(status.running).toBe(true);
      expect(status.elapsed).toBeGreaterThanOrEqual(4);
      expect(status.totalWithElapsed).toBeGreaterThanOrEqual(4);
    });

    it("getStopwatchStatus returns stopped stopwatch details", () => {
      const client = new PlankaClient({ baseUrl: "https://planka.test", apiKey: "key", fetch: makeFetchMock(200, {}) });

      const status = client.getStopwatchStatus({ total: 500, startedAt: null });

      expect(status.running).toBe(false);
      expect(status.elapsed).toBe(0);
      expect(status.totalWithElapsed).toBe(500);
    });
  });
});
