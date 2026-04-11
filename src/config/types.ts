export interface ConnectionConfig {
  base_url: string;
  api_key: string;
  board_id: string;
}

export interface ListsConfig {
  inbox: string;
  backlog: string;
  noise?: string;
  focus?: string;
  today?: string;
  active: string;
  blocked: string;
  calendar?: string;
  done: string;
}

export interface WipLimitsConfig {
  noise?: number;
  focus?: number;
  [key: string]: number | undefined;
}

export interface TransitionsConfig {
  [fromList: string]: string[];
}

export interface SortRule {
  field: "createdAt" | "dueDate" | "name";
  order: "asc" | "desc";
}

export interface SortRulesConfig {
  [listKey: string]: SortRule;
}

export interface ArchiveConfig {
  never_delete_done: boolean;
  search_enabled: boolean;
  page_size: number;
}

export interface DueDateWindowsConfig {
  approaching: DueDateWindow;
  imminent: DueDateWindow;
}

export interface DueDateWindow {
  min_hours?: number;
  max_hours: number;
}

export interface BoardConfig {
  card_type: "project";
  lists: ListsConfig;
  wip_limits: WipLimitsConfig;
  transitions: TransitionsConfig;
  default_capture_list: string;
  sort_rules: SortRulesConfig;
  archive: ArchiveConfig;
  due_date_windows: DueDateWindowsConfig;
}

export interface LabelCategoriesConfig {
  domain: string[];
  source: string[];
  type: string[];
}

export interface LabelsConfig {
  categories: LabelCategoriesConfig;
  required_on_triage: string[];
}

export interface CustomFieldConfig {
  field_name: string;
  type: "number" | "datetime" | "text";
  range?: [number, number];
  unit?: string;
  show_in_summary: boolean;
  required_on_triage: boolean;
  validation?: string;
}

export interface CustomFieldsConfig {
  priority: CustomFieldConfig;
  duration: CustomFieldConfig;
  scheduled?: CustomFieldConfig;
}

export interface PomodoroConfig {
  work_interval_minutes: number;
  rest_interval_minutes: number;
  intervals_before_long_rest: number;
  long_rest_minutes: number;
}

export interface ForgivingSystemConfig {
  enabled: boolean;
  rules: {
    never_extend_other_due_dates: boolean;
    suggest_deprioritize_today: boolean;
    suggest_split_duration: boolean;
    always_surface_overdue: boolean;
  };
}

export interface ResponseTierConfig {
  tier1: string[];
  tier2_additions: string[];
  tier3_additions: string[];
}

export interface GeneratedToolConfig {
  name: string;
  description: string;
  composed_of: string[];
  defaults?: Record<string, string>;
  required_params?: string[];
}

export interface ToolsConfig {
  generate: GeneratedToolConfig[];
}

export interface CacheConfig {
  skeleton_ttl_seconds: number;
  preload: boolean;
}

export interface PlankaConfig {
  connection: ConnectionConfig;
  board: BoardConfig;
  labels: LabelsConfig;
  custom_fields: CustomFieldsConfig;
  pomodoro: PomodoroConfig;
  forgiving_system: ForgivingSystemConfig;
  response: ResponseTierConfig;
  tools: ToolsConfig;
  cache: CacheConfig;
}
