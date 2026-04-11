import { initializeServices, resolvePort, resolveUseHttp } from "./bootstrap.js";
import { startHttpServer } from "./http-server.js";
import { startStdioServer } from "./stdio-server.js";

const SERVER_NAME = "planka-pms";
const SERVER_VERSION = "0.1.0";

function log(message: string): void {
  process.stderr.write(`[${SERVER_NAME}] ${message}\n`);
}

async function main(): Promise<void> {
  const services = await initializeServices(SERVER_NAME);
  const useHttp = resolveUseHttp();

  if (useHttp) {
    const port = resolvePort();
    const runtime = await startHttpServer({
      services,
      serverName: SERVER_NAME,
      serverVersion: SERVER_VERSION,
      port,
    });

    const shutdown = async (): Promise<void> => {
      log("Shutting down HTTP server...");
      await runtime.close();
      log("HTTP server closed");
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    return;
  }

  const runtime = await startStdioServer({
    services,
    serverName: SERVER_NAME,
    serverVersion: SERVER_VERSION,
  });

  const shutdown = async (): Promise<void> => {
    log("Shutting down stdio server...");
    await runtime.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  log(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
