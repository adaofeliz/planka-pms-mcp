import { normalizeBoardSkeleton } from "./client/cache.js";
import { loadConfig } from "./config/loader.js";
import { createServiceContainer, type ServiceContainer } from "./service-container.js";

function formatStartupError(configPath: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);

  if (message.startsWith("Missing required environment variable:")) {
    const variable = message.split(":")[1]?.trim() ?? "unknown";
    return new Error(
      `Configuration failed (${configPath}): missing environment variable ${variable}. ` +
        "Set it in your .env file or shell environment.",
    );
  }

  if (message.startsWith("Cannot read config file:")) {
    return new Error(`Configuration failed: ${message}`);
  }

  if (message.startsWith("Invalid YAML in config file:")) {
    return new Error(`Configuration failed: ${message}`);
  }

  if (message.startsWith("Config validation failed:")) {
    return new Error(`Configuration failed (${configPath}): ${message}`);
  }

  return new Error(`Service initialization failed (${configPath}): ${message}`);
}

export function resolveConfigPath(): string {
  const flag = process.argv.find((a) => a.startsWith("--config="));
  if (flag) {
    return flag.split("=")[1]!;
  }

  return process.env.PLANKA_CONFIG_PATH ?? "config/default.yaml";
}

export function resolvePort(): number {
  const portFlag = process.argv.find((a) => a.startsWith("--port="));
  if (!portFlag) {
    return 3000;
  }

  const value = Number(portFlag.split("=")[1]);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`Invalid --port value: ${portFlag.split("=")[1]}. Expected an integer in range 1-65535.`);
  }

  return value;
}

export function resolveUseHttp(): boolean {
  return process.argv.includes("--http");
}

export async function initializeServices(serverName: string): Promise<ServiceContainer> {
  const configPath = resolveConfigPath();
  let services: ServiceContainer;

  try {
    const config = loadConfig(configPath);
    services = createServiceContainer(config, serverName);
  } catch (error) {
    throw formatStartupError(configPath, error);
  }

  if (services.config.cache.preload) {
    try {
      const boardResponse = await services.client.getBoard(services.config.connection.board_id);
      const skeleton = normalizeBoardSkeleton(boardResponse);
      services.cache.set(services.config.connection.board_id, skeleton);
      services.logger.info("Board skeleton preloaded", { boardId: services.config.connection.board_id });
    } catch (err) {
      services.logger.warn("Board skeleton preload failed (will retry on first tool call)", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return services;
}
