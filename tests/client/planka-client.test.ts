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
});
