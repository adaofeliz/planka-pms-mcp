import type { Logger } from "../utils/logger.js";
import { ApiError } from "../utils/errors.js";
import type {
  BoardResponse,
  CardResponse,
  CardsResponse,
  CommentsResponse,
  ActionsResponse,
  GetCardsByListOptions,
} from "./types.js";

export interface PlankaClientOptions {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  logger?: Logger;
}

export class PlankaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetch: typeof globalThis.fetch;
  private readonly logger: Logger | undefined;

  constructor(options: PlankaClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.logger = options.logger;
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      query?: Record<string, string | string[] | undefined>;
    },
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (options?.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const v of value) {
            url.searchParams.append(key, v);
          }
        } else {
          url.searchParams.set(key, value);
        }
      }
    }

    const headers: Record<string, string> = {
      "X-Api-Key": this.apiKey,
      "Content-Type": "application/json",
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    };

    this.logger?.debug(`${method} ${url.toString()}`);

    const response = await this.fetch(url.toString(), fetchOptions);

    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorBody = (await response.json()) as { message?: string; error?: string };
        errorMessage = errorBody.message ?? errorBody.error ?? response.statusText;
      } catch {
        errorMessage = response.statusText;
      }
      throw new ApiError(`Planka API error: ${response.status} ${errorMessage}`, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError("Failed to parse Planka API response", response.status);
    }
  }

  async getBoard(boardId: string): Promise<BoardResponse> {
    return this.request<BoardResponse>("GET", `/api/boards/${boardId}`);
  }

  async getCard(cardId: string): Promise<CardResponse> {
    return this.request<CardResponse>("GET", `/api/cards/${cardId}`);
  }

  async getCardsByList(listId: string, options?: GetCardsByListOptions): Promise<CardsResponse> {
    const query: Record<string, string | string[] | undefined> = {};

    if (options?.before) {
      query["before[listChangedAt]"] = options.before.listChangedAt;
      query["before[id]"] = options.before.id;
    }
    if (options?.search) {
      query.search = options.search;
    }
    if (options?.userIds?.length) {
      query.userIds = options.userIds.join(",");
    }
    if (options?.labelIds?.length) {
      query.labelIds = options.labelIds.join(",");
    }

    return this.request<CardsResponse>("GET", `/api/lists/${listId}/cards`, { query });
  }

  async getComments(cardId: string): Promise<CommentsResponse> {
    return this.request<CommentsResponse>("GET", `/api/cards/${cardId}/comments`);
  }

  async getCardActions(cardId: string): Promise<ActionsResponse> {
    return this.request<ActionsResponse>("GET", `/api/cards/${cardId}/actions`);
  }
}
