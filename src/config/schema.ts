import { z } from "zod";

export const plankaConfigSchema = z.object({
  connection: z.object({
    base_url: z.string().min(1),
    api_key: z.string().min(1),
    board_id: z.string().min(1),
  }),
  board: z.object({
    card_type: z.literal("project"),
    lists: z.object({
      inbox: z.string(),
      backlog: z.string(),
      noise: z.string().optional(),
      focus: z.string().optional(),
      today: z.string().optional(),
      active: z.string(),
      blocked: z.string(),
      calendar: z.string().optional(),
      done: z.string(),
    }),
    wip_limits: z.record(z.string(), z.number().positive().optional()).default({}),
    transitions: z.record(z.string(), z.array(z.string())),
    default_capture_list: z.string(),
    sort_rules: z.record(
      z.string(),
      z.object({
        field: z.enum(["createdAt", "dueDate", "name"]),
        order: z.enum(["asc", "desc"]),
      }),
    ),
    archive: z.object({
      never_delete_done: z.boolean(),
      search_enabled: z.boolean(),
      page_size: z.number().positive(),
    }),
    due_date_windows: z.object({
      approaching: z.object({
        min_hours: z.number().optional(),
        max_hours: z.number(),
      }),
      imminent: z.object({
        max_hours: z.number(),
      }),
    }),
  }),
  labels: z.object({
    categories: z.object({
      domain: z.array(z.string()),
      source: z.array(z.string()),
      type: z.array(z.string()),
    }),
    required_on_triage: z.array(z.string()),
  }),
  custom_fields: z.object({
    priority: z.object({
      field_name: z.string(),
      type: z.enum(["number", "datetime", "text"]),
      range: z.tuple([z.number(), z.number()]).optional(),
      unit: z.string().optional(),
      show_in_summary: z.boolean(),
      required_on_triage: z.boolean(),
      validation: z.string().optional(),
    }),
    duration: z.object({
      field_name: z.string(),
      type: z.enum(["number", "datetime", "text"]),
      range: z.tuple([z.number(), z.number()]).optional(),
      unit: z.string().optional(),
      show_in_summary: z.boolean(),
      required_on_triage: z.boolean(),
      validation: z.string().optional(),
    }),
    scheduled: z
      .object({
        field_name: z.string(),
        type: z.enum(["number", "datetime", "text"]),
        range: z.tuple([z.number(), z.number()]).optional(),
        unit: z.string().optional(),
        show_in_summary: z.boolean(),
        required_on_triage: z.boolean(),
        validation: z.string().optional(),
      })
      .optional(),
  }),
  pomodoro: z.object({
    work_interval_minutes: z.number().positive(),
    rest_interval_minutes: z.number().positive(),
    intervals_before_long_rest: z.number().positive(),
    long_rest_minutes: z.number().positive(),
  }),
  forgiving_system: z.object({
    enabled: z.boolean(),
    rules: z.object({
      never_extend_other_due_dates: z.boolean(),
      suggest_deprioritize_today: z.boolean(),
      suggest_split_duration: z.boolean(),
      always_surface_overdue: z.boolean(),
    }),
  }),
  response: z.object({
    tier1: z.array(z.string()).min(1),
    tier2_additions: z.array(z.string()).min(1),
    tier3_additions: z.array(z.string()).min(1),
  }),
  tools: z.object({
    generate: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        composed_of: z.array(z.string()),
        defaults: z.record(z.string(), z.string()).optional(),
        required_params: z.array(z.string()).optional(),
      }),
    ),
  }),
  cache: z.object({
    skeleton_ttl_seconds: z.number().positive(),
    preload: z.boolean(),
  }),
});

export type PlankaConfigInput = z.input<typeof plankaConfigSchema>;
