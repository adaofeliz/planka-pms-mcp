import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { config as dotenvConfig } from "dotenv";
import { parse } from "yaml";

import { plankaConfigSchema } from "./schema.js";
import type { PlankaConfig } from "./types.js";
import { ConfigError } from "../utils/errors.js";

dotenvConfig();

export function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, name: string) => {
    const envValue = process.env[name];
    if (envValue === undefined) {
      throw new ConfigError(`Missing required environment variable: ${name}`, [
        `Set ${name} in your .env file or environment`,
      ]);
    }
    return envValue;
  });
}

function resolveEnvVarsDeep(obj: unknown): unknown {
  if (typeof obj === "string") {
    return resolveEnvVars(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(resolveEnvVarsDeep);
  }
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, value]) => [
        key,
        resolveEnvVarsDeep(value),
      ]),
    );
  }

  return obj;
}

export function loadConfig(configPath: string): PlankaConfig {
  const absolutePath = resolve(process.cwd(), configPath);

  let raw: string;
  try {
    raw = readFileSync(absolutePath, "utf-8");
  } catch {
    throw new ConfigError(`Cannot read config file: ${absolutePath}`, [
      `Ensure the file exists at ${absolutePath}`,
    ]);
  }

  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (error) {
    throw new ConfigError(`Invalid YAML in config file: ${absolutePath}`, [
      error instanceof Error ? error.message : String(error),
    ]);
  }

  const resolved = resolveEnvVarsDeep(parsed);
  const result = plankaConfigSchema.safeParse(resolved);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new ConfigError(`Config validation failed: ${issues[0]}`, issues);
  }

  return result.data as PlankaConfig;
}
