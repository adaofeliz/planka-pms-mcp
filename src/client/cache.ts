import type {
  BoardResponse,
  PlankaCard,
  PlankaCardLabel,
  PlankaCustomField,
  PlankaCustomFieldGroup,
  PlankaLabel,
  PlankaList,
  PlankaUser,
} from "./types.js";

export interface BoardSkeleton {
  board: BoardResponse["item"];
  lists: PlankaList[];
  labels: PlankaLabel[];
  cardLabels: PlankaCardLabel[];
  customFieldGroups: PlankaCustomFieldGroup[];
  customFields: PlankaCustomField[];
  members: PlankaUser[];
  cards: PlankaCard[];
  doneListId?: string;
  archiveListId?: string;
}

export interface CacheEntry {
  value: BoardSkeleton;
  expiresAt: number;
}

export function normalizeBoardSkeleton(response: BoardResponse): BoardSkeleton {
  const lists = response.included.lists ?? [];
  const doneList = lists.find((list) => list.type === "closed");
  const archiveList = lists.find((list) => list.type === "archive");

  return {
    board: response.item,
    lists,
    labels: response.included.labels ?? [],
    cardLabels: response.included.cardLabels ?? [],
    customFieldGroups: response.included.customFieldGroups ?? [],
    customFields: response.included.customFields ?? [],
    members: response.included.users ?? [],
    cards: response.included.cards ?? [],
    doneListId: doneList?.id,
    archiveListId: archiveList?.id,
  };
}

export class BoardSkeletonCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  get(boardId: string, now = Date.now()): BoardSkeleton | undefined {
    const entry = this.entries.get(boardId);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= now) {
      this.entries.delete(boardId);
      return undefined;
    }

    return entry.value;
  }

  set(boardId: string, value: BoardSkeleton, now = Date.now()): BoardSkeleton {
    this.entries.set(boardId, {
      value,
      expiresAt: now + this.ttlMs,
    });
    return value;
  }

  invalidate(boardId: string): void {
    this.entries.delete(boardId);
  }
}
