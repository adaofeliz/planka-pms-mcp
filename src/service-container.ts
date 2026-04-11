import type { PlankaConfig } from "./config/types.js";
import { PlankaClient } from "./client/planka-client.js";
import { BoardSkeletonCache } from "./client/cache.js";
import { createLogger, type Logger } from "./utils/logger.js";

export interface ServiceContainer {
  config: PlankaConfig;
  client: PlankaClient;
  cache: BoardSkeletonCache;
  logger: Logger;
}

export function createServiceContainer(config: PlankaConfig, serverName: string): ServiceContainer {
  const logger = createLogger(serverName);
  const client = new PlankaClient({
    baseUrl: config.connection.base_url,
    apiKey: config.connection.api_key,
    logger,
  });
  const cache = new BoardSkeletonCache(config.cache.skeleton_ttl_seconds * 1000);
  return { config, client, cache, logger };
}
