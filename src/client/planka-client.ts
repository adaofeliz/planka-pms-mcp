import type { Logger } from "../utils/logger.js";
import { ApiError } from "../utils/errors.js";
import { BoardSkeletonCache, normalizeBoardSkeleton, type BoardSkeleton } from "./cache.js";
import type {
  ActionsResponse,
  BoardResponse,
  CardResponse,
  CardsResponse,
  CommentResponse,
  CommentsResponse,
  CreateCardInput,
  CreateTaskInput,
  CreateTaskListInput,
  GetCardsByListOptions,
  ListWithCardsResponse,
  StopwatchData,
  StopwatchStatus,
  TaskListResponse,
  TaskResponse,
  UpdateCardInput,
  UpdateTaskInput,
  UpdateTaskListInput,
} from "./types.js";

export interface PlankaClientOptions {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  logger?: Logger;
  boardSkeletonTtlMs?: number;
}

export class PlankaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetch: typeof globalThis.fetch;
  private readonly logger: Logger | undefined;
  private readonly boardSkeletonCache: BoardSkeletonCache;
  private readonly boardSkeletonInFlight = new Map<string, Promise<BoardSkeleton>>();

  constructor(options: PlankaClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.logger = options.logger;
    this.boardSkeletonCache = new BoardSkeletonCache(options.boardSkeletonTtlMs ?? 300_000);
  }

  async getBoardSkeleton(boardId: string, forceRefresh = false): Promise<BoardSkeleton> {
    if (!forceRefresh) {
      const cached = this.boardSkeletonCache.get(boardId);
      if (cached) {
        return cached;
      }
    }

    const inFlight = this.boardSkeletonInFlight.get(boardId);
    if (inFlight) {
      return inFlight;
    }

    const fetchPromise = this.fetchBoardSkeleton(boardId, forceRefresh);
    this.boardSkeletonInFlight.set(boardId, fetchPromise);

    try {
      return await fetchPromise;
    } finally {
      this.boardSkeletonInFlight.delete(boardId);
    }
  }

  async preloadBoardSkeleton(boardId: string): Promise<void> {
    await this.getBoardSkeleton(boardId);
  }

  invalidateBoardSkeleton(boardId: string): void {
    this.boardSkeletonCache.invalidate(boardId);
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

  async createCard(listId: string, data: CreateCardInput): Promise<CardResponse> {
    return this.request<CardResponse>("POST", `/api/lists/${listId}/cards`, { body: data });
  }

  async updateCard(cardId: string, data: UpdateCardInput): Promise<CardResponse> {
    return this.request<CardResponse>("PATCH", `/api/cards/${cardId}`, { body: data });
  }

  async deleteCard(cardId: string): Promise<CardResponse> {
    return this.request<CardResponse>("DELETE", `/api/cards/${cardId}`);
  }

  async moveCard(cardId: string, targetListId: string, position?: number): Promise<CardResponse> {
    const body: UpdateCardInput = { listId: targetListId };
    if (position !== undefined) body.position = position;
    return this.request<CardResponse>("PATCH", `/api/cards/${cardId}`, { body });
  }

  async addCardLabel(cardId: string, labelId: string): Promise<void> {
    await this.request<unknown>("POST", `/api/cards/${cardId}/card-labels`, {
      body: { labelId },
    });
  }

  async removeCardLabel(cardId: string, labelId: string): Promise<void> {
    await this.request<unknown>("DELETE", `/api/cards/${cardId}/card-labels/labelId::${labelId}`);
  }

  async addCardMember(cardId: string, userId: string): Promise<void> {
    await this.request<unknown>("POST", `/api/cards/${cardId}/card-memberships`, {
      body: { userId },
    });
  }

  async removeCardMember(cardId: string, userId: string): Promise<void> {
    await this.request<unknown>("DELETE", `/api/cards/${cardId}/card-memberships/userId::${userId}`);
  }

  async createTaskList(cardId: string, data: CreateTaskListInput): Promise<TaskListResponse> {
    return this.request<TaskListResponse>("POST", `/api/cards/${cardId}/task-lists`, { body: data });
  }

  async updateTaskList(taskListId: string, data: UpdateTaskListInput): Promise<TaskListResponse> {
    return this.request<TaskListResponse>("PATCH", `/api/task-lists/${taskListId}`, { body: data });
  }

  async deleteTaskList(taskListId: string): Promise<TaskListResponse> {
    return this.request<TaskListResponse>("DELETE", `/api/task-lists/${taskListId}`);
  }

  async createTask(taskListId: string, data: CreateTaskInput): Promise<TaskResponse> {
    return this.request<TaskResponse>("POST", `/api/task-lists/${taskListId}/tasks`, { body: data });
  }

  async updateTask(taskId: string, data: UpdateTaskInput): Promise<TaskResponse> {
    return this.request<TaskResponse>("PATCH", `/api/tasks/${taskId}`, { body: data });
  }

  async deleteTask(taskId: string): Promise<TaskResponse> {
    return this.request<TaskResponse>("DELETE", `/api/tasks/${taskId}`);
  }

  async createComment(cardId: string, text: string): Promise<CommentResponse> {
    return this.request<CommentResponse>("POST", `/api/cards/${cardId}/comments`, {
      body: { text },
    });
  }

  async setCustomFieldValue(cardId: string, groupId: string, fieldId: string, value: string): Promise<void> {
    const path = `/api/cards/${cardId}/custom-field-values/customFieldGroupId:${groupId}:customFieldId:${fieldId}`;
    await this.request<unknown>("PATCH", path, { body: { value } });
  }

  async clearCustomFieldValue(cardId: string, groupId: string, fieldId: string): Promise<void> {
    const path = `/api/cards/${cardId}/custom-field-values/customFieldGroupId:${groupId}:customFieldId:${fieldId}`;
    await this.request<unknown>("DELETE", path);
  }

  async getArchivedCards(archiveListId: string, options?: GetCardsByListOptions): Promise<CardsResponse> {
    return this.getCardsByList(archiveListId, options);
  }

  async archiveCard(cardId: string, archiveListId: string): Promise<CardResponse> {
    return this.request<CardResponse>("PATCH", `/api/cards/${cardId}`, {
      body: { listId: archiveListId, position: null },
    });
  }

  async sortList(
    listId: string,
    fieldName: "name" | "dueDate" | "createdAt",
    order: "asc" | "desc",
  ): Promise<ListWithCardsResponse> {
    return this.request<ListWithCardsResponse>("POST", `/api/lists/${listId}/sort`, {
      body: { fieldName, order },
    });
  }

  startStopwatch(cardId: string, existingTotal: number): Promise<CardResponse> {
    const stopwatch: StopwatchData = {
      total: existingTotal,
      startedAt: new Date().toISOString(),
    };
    return this.request<CardResponse>("PATCH", `/api/cards/${cardId}`, {
      body: { stopwatch },
    });
  }

  async stopStopwatch(cardId: string, existingTotal: number, startedAt: string): Promise<CardResponse> {
    const elapsedSeconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    const newTotal = existingTotal + elapsedSeconds;
    const stopwatch: StopwatchData = {
      total: newTotal,
      startedAt: null,
    };
    return this.request<CardResponse>("PATCH", `/api/cards/${cardId}`, {
      body: { stopwatch },
    });
  }

  async resetStopwatch(cardId: string): Promise<CardResponse> {
    const stopwatch: StopwatchData = { total: 0, startedAt: null };
    return this.request<CardResponse>("PATCH", `/api/cards/${cardId}`, {
      body: { stopwatch },
    });
  }

  getStopwatchStatus(stopwatch: StopwatchData): StopwatchStatus {
    const { startedAt } = stopwatch;
    const running = startedAt !== null;
    const elapsed = startedAt === null ? 0 : Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);

    return {
      total: stopwatch.total,
      startedAt,
      running,
      elapsed,
      totalWithElapsed: stopwatch.total + elapsed,
    };
  }

  private async fetchBoardSkeleton(boardId: string, forceRefresh: boolean): Promise<BoardSkeleton> {
    if (forceRefresh) {
      this.boardSkeletonCache.invalidate(boardId);
    }

    const board = await this.getBoard(boardId);
    const normalized = normalizeBoardSkeleton(board);
    this.boardSkeletonCache.set(boardId, normalized);
    return normalized;
  }
}
