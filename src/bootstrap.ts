import { normalizeBoardSkeleton } from "./client/cache.js";
import { loadConfig } from "./config/loader.js";
import { createServiceContainer, type ServiceContainer } from "./service-container.js";

export function resolveConfigPath(): string {
  const flag = process.argv.find((a) => a.startsWith("--config="));
  if (flag) {
    return flag.split("=")[1]!;
  }

  return process.env.PLANKA_CONFIG_PATH ?? "config/default.yaml";
}

export function resolvePort(): number {
  const portFlag = process.argv.find((a) => a.startsWith("--port="));
  return portFlag ? Number(portFlag.split("=")[1]) : 3000;
}

export function resolveUseHttp(): boolean {
  return process.argv.includes("--http");
}

export async function initializeServices(serverName: string): Promise<ServiceContainer> {
  const configPath = resolveConfigPath();
  const config = loadConfig(configPath);
  const services = createServiceContainer(config, serverName);

  if (config.cache.preload) {
    try {
      const boardResponse = await services.client.getBoard(config.connection.board_id);
      const skeleton = normalizeBoardSkeleton(boardResponse);
      services.cache.set(config.connection.board_id, skeleton);
      services.logger.info("Board skeleton preloaded", { boardId: config.connection.board_id });
    } catch (err) {
      services.logger.warn("Board skeleton preload failed (will retry on first tool call)", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return services;
}
