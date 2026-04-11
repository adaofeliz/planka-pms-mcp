export interface StopwatchData {
  total: number;
  startedAt: string | null;
}

export interface PlankaCard {
  id: string;
  createdAt: string;
  updatedAt: string;
  type: "project" | "story";
  position: number;
  name: string;
  description: string | null;
  dueDate: string | null;
  isDueCompleted: boolean;
  stopwatch: StopwatchData;
  commentsTotal: number;
  isClosed: boolean;
  listChangedAt: string;
  boardId: string;
  listId: string;
  creatorUserId: string;
  prevListId: string | null;
  coverAttachmentId: string | null;
  isSubscribed: boolean;
}

export interface PlankaList {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  position: number;
  color: string | null;
  type: "active" | "closed" | "archive" | "trash";
  boardId: string;
}

export interface PlankaLabel {
  id: string;
  name: string | null;
  color: string;
  position: number;
  boardId: string;
}

export interface PlankaUser {
  id: string;
  name: string;
  username: string;
  email: string;
}

export interface PlankaCustomField {
  id: string;
  name: string;
  type: string;
  position: number;
}

export interface PlankaCustomFieldGroup {
  id: string;
  name: string;
  boardId?: string;
}

export interface PlankaCustomFieldValue {
  id: string;
  value: string;
  customFieldGroupId: string;
  customFieldId: string;
  cardId: string;
}

export interface PlankaTaskList {
  id: string;
  name: string;
  position: number;
  cardId: string;
  showOnFrontOfCard: boolean;
  hideCompletedTasks: boolean;
}

export interface PlankaTask {
  id: string;
  name: string;
  position: number;
  isCompleted: boolean;
  taskListId: string;
  assigneeUserId: string | null;
}

export interface PlankaComment {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  cardId: string;
  userId: string;
}

export interface PlankaAction {
  id: string;
  type: string;
  createdAt: string;
  cardId: string;
  userId: string;
  data: Record<string, unknown>;
}

export interface PlankaBoardMembership {
  id: string;
  role: string;
  userId: string;
  boardId: string;
}

export interface PlankaCardLabel {
  id: string;
  cardId: string;
  labelId: string;
}

export interface PlankaCardMembership {
  id: string;
  cardId: string;
  userId: string;
}

export interface BoardIncluded {
  boardMemberships: PlankaBoardMembership[];
  labels: PlankaLabel[];
  lists: PlankaList[];
  cards: PlankaCard[];
  cardMemberships: PlankaCardMembership[];
  cardLabels: PlankaCardLabel[];
  taskLists: PlankaTaskList[];
  tasks: PlankaTask[];
  customFieldGroups: PlankaCustomFieldGroup[];
  customFields: PlankaCustomField[];
  customFieldValues: PlankaCustomFieldValue[];
  users: PlankaUser[];
  projects: unknown[];
  attachments: unknown[];
}

export interface BoardResponse {
  item: {
    id: string;
    name: string;
    defaultCardType: string;
  };
  included: BoardIncluded;
}

export interface CardIncluded {
  taskLists: PlankaTaskList[];
  tasks: PlankaTask[];
  cardLabels: PlankaCardLabel[];
  cardMemberships: PlankaCardMembership[];
  attachments: unknown[];
  customFieldGroups: PlankaCustomFieldGroup[];
  customFields: PlankaCustomField[];
  customFieldValues: PlankaCustomFieldValue[];
}

export interface CardResponse {
  item: PlankaCard;
  included: CardIncluded;
}

export interface CardsResponse {
  items: PlankaCard[];
  included: {
    cardLabels: PlankaCardLabel[];
    cardMemberships: PlankaCardMembership[];
    taskLists: PlankaTaskList[];
    tasks: PlankaTask[];
    customFieldGroups: PlankaCustomFieldGroup[];
    customFields: PlankaCustomField[];
    customFieldValues: PlankaCustomFieldValue[];
    users: PlankaUser[];
  };
}

export interface CommentsResponse {
  items: PlankaComment[];
  included: { users: PlankaUser[] };
}

export interface ActionsResponse {
  items: PlankaAction[];
  included: { users: PlankaUser[] };
}

export interface CardCursor {
  listChangedAt: string;
  id: string;
}

export interface GetCardsByListOptions {
  before?: CardCursor;
  search?: string;
  userIds?: string[];
  labelIds?: string[];
}

export interface CreateTaskListInput {
  name: string;
  position: number;
}

export interface UpdateTaskListInput {
  name?: string;
  position?: number;
}

export interface TaskListResponse {
  item: PlankaTaskList;
  included: { tasks: PlankaTask[] };
}

export interface CreateTaskInput {
  name: string;
  position: number;
  isCompleted?: boolean;
}

export interface UpdateTaskInput {
  name?: string;
  position?: number;
  isCompleted?: boolean;
  taskListId?: string;
}

export interface TaskResponse {
  item: PlankaTask;
}

export interface CreateCardInput {
  type: "project";
  name: string;
  position?: number;
  description?: string | null;
  dueDate?: string | null;
  isDueCompleted?: boolean;
  stopwatch?: StopwatchData;
}

export interface UpdateCardInput {
  name?: string;
  description?: string | null;
  dueDate?: string | null;
  isDueCompleted?: boolean;
  stopwatch?: StopwatchData;
  listId?: string;
  position?: number;
}

export interface CreateCommentInput {
  text: string;
}

export interface CommentResponse {
  item: PlankaComment;
  included: { users: PlankaUser[] };
}

export interface SortListInput {
  fieldName: "name" | "dueDate" | "createdAt";
  order: "asc" | "desc";
}

export interface ListWithCardsResponse {
  items: PlankaCard[];
  included: {
    cardLabels: PlankaCardLabel[];
    cardMemberships: PlankaCardMembership[];
    taskLists: PlankaTaskList[];
    tasks: PlankaTask[];
    customFieldGroups: PlankaCustomFieldGroup[];
    customFields: PlankaCustomField[];
    customFieldValues: PlankaCustomFieldValue[];
    users: PlankaUser[];
  };
}

export interface StopwatchStatus {
  total: number;
  startedAt: string | null;
  running: boolean;
  elapsed: number;
  totalWithElapsed: number;
}
