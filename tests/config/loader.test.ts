import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { loadConfig, resolveEnvVars } from "../../src/config/loader.js";
import { ConfigError } from "../../src/utils/errors.js";

const originalEnv = { ...process.env };
const tempDirs: string[] = [];

function writeTempYaml(content: string): string {
  const dirPath = mkdtempSync(join(tmpdir(), "planka-config-test-"));
  tempDirs.push(dirPath);
  const filePath = join(dirPath, "config.yaml");
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

const minimalValidYaml = `
connection:
  base_url: "${"${PLANKA_BASE_URL}"}"
  api_key: "${"${PLANKA_API_KEY}"}"
  board_id: "${"${PLANKA_BOARD_ID}"}"
board:
  card_type: "project"
  lists:
    inbox: "INBOX"
    backlog: "BACKLOG"
    active: "ACTIVE"
    blocked: "BLOCKED"
    done: "DONE"
  wip_limits: {}
  transitions:
    inbox: [backlog]
    backlog: [active]
    active: [done]
    blocked: [active]
    done: []
  default_capture_list: inbox
  sort_rules:
    inbox:
      field: createdAt
      order: asc
  archive:
    never_delete_done: true
    search_enabled: true
    page_size: 25
  due_date_windows:
    approaching:
      min_hours: 24
      max_hours: 72
    imminent:
      max_hours: 24
labels:
  categories:
    domain: [Work]
    source: ["Source: Email"]
    type: ["Type: FOCUS"]
  required_on_triage: [domain, type]
custom_fields:
  priority:
    field_name: Priority
    type: number
    range: [1, 5]
    show_in_summary: true
    required_on_triage: true
  duration:
    field_name: "Duration (min)"
    type: number
    unit: minutes
    show_in_summary: true
    required_on_triage: true
pomodoro:
  work_interval_minutes: 30
  rest_interval_minutes: 10
  intervals_before_long_rest: 4
  long_rest_minutes: 30
forgiving_system:
  enabled: true
  rules:
    never_extend_other_due_dates: true
    suggest_deprioritize_today: true
    suggest_split_duration: true
    always_surface_overdue: true
response:
  tier1: [id]
  tier2_additions: [description]
  tier3_additions: [comments]
tools:
  generate:
    - name: triage_card
      description: triage
      composed_of: [move_card]
cache:
  skeleton_ttl_seconds: 300
  preload: true
`;

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value;
  }

  while (tempDirs.length > 0) {
    const dirPath = tempDirs.pop();
    if (dirPath) {
      rmSync(dirPath, { recursive: true, force: true });
    }
  }
});

describe("resolveEnvVars", () => {
  it("returns original string when there are no placeholders", () => {
    expect(resolveEnvVars("hello")).toBe("hello");
  });

  it("resolves a placeholder from process.env", () => {
    process.env.MY_VAR = "value";
    expect(resolveEnvVars("${MY_VAR}")).toBe("value");
  });

  it("throws ConfigError for missing environment variable", () => {
    delete process.env.MISSING_VAR_XYZ;
    expect(() => resolveEnvVars("${MISSING_VAR_XYZ}")).toThrowError(ConfigError);
  });
});

describe("loadConfig", () => {
  it("loads a valid config from temp file", () => {
    process.env.PLANKA_BASE_URL = "https://example.com";
    process.env.PLANKA_API_KEY = "test-key";
    process.env.PLANKA_BOARD_ID = "test-board";

    const filePath = writeTempYaml(minimalValidYaml);
    const config = loadConfig(filePath);

    expect(config.connection.base_url).toBe("https://example.com");
    expect(config.connection.api_key).toBe("test-key");
    expect(config.connection.board_id).toBe("test-board");
    expect(config.board.card_type).toBe("project");
  });

  it("throws ConfigError when config file is missing", () => {
    expect(() => loadConfig("tests/config/does-not-exist.yaml")).toThrowError(ConfigError);
  });

  it("throws ConfigError for invalid YAML", () => {
    const filePath = writeTempYaml("connection: [\n");
    expect(() => loadConfig(filePath)).toThrowError(ConfigError);
  });

  it("throws ConfigError when environment variable is missing", () => {
    process.env.PLANKA_BASE_URL = "https://example.com";
    process.env.PLANKA_API_KEY = "test-key";
    delete process.env.PLANKA_BOARD_ID;

    const filePath = writeTempYaml(minimalValidYaml);

    expect(() => loadConfig(filePath)).toThrowError(ConfigError);
    expect(() => loadConfig(filePath)).toThrowError(/PLANKA_BOARD_ID/);
  });

  it("throws ConfigError when schema validation fails", () => {
    process.env.PLANKA_BASE_URL = "https://example.com";
    process.env.PLANKA_API_KEY = "test-key";
    process.env.PLANKA_BOARD_ID = "test-board";

    const invalidCardTypeYaml = minimalValidYaml.replace('card_type: "project"', 'card_type: "story"');
    const filePath = writeTempYaml(invalidCardTypeYaml);

    expect(() => loadConfig(filePath)).toThrowError(ConfigError);
  });

  it("loads config/default.yaml with env vars and validates expected shape", () => {
    process.env.PLANKA_BASE_URL = "https://example.com";
    process.env.PLANKA_API_KEY = "test-key";
    process.env.PLANKA_BOARD_ID = "test-board";

    const config = loadConfig("config/default.yaml");

    expect(config.board.card_type).toBe("project");
    expect(config.board.lists.inbox).toBe("INBOX");
    expect(config.tools.generate).toHaveLength(4);
    expect(config.cache.skeleton_ttl_seconds).toBe(300);
  });
});
