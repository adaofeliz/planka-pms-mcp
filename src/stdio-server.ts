import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import type { ServiceContainer } from "./service-container.js";
import { CORE_TOOL_DEFINITIONS } from "./tools/core/index.js";
import { registerCoreTools, registerWorkflowTools } from "./tools/generator.js";

export interface StdioServerRuntime {
  server: McpServer;
  transport: StdioServerTransport;
  close: () => Promise<void>;
}

export async function startStdioServer(options: {
  services: ServiceContainer;
  serverName: string;
  serverVersion: string;
}): Promise<StdioServerRuntime> {
  const { services, serverName, serverVersion } = options;
  const log = (message: string): void => {
    process.stderr.write(`[${serverName}] ${message}\n`);
  };

  log("Starting in stdio mode");
  const server = new McpServer({
    name: serverName,
    version: serverVersion,
  });

  registerCoreTools(server, CORE_TOOL_DEFINITIONS, services.config, services.client, services.cache, services.logger);
  registerWorkflowTools(server, services.config, services.client, services.cache, services.logger);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("Server connected via stdio");

  return {
    server,
    transport,
    close: async () => {
      await server.close();
    },
  };
}
