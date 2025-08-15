import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLogger } from "./utils";
import {
  validateEnvironment,
  performStartupChecks,
  createMcpServer,
  createShutdownHandler,
  setupGracefulShutdown,
} from "./server-common";

/**
 * Main server initialization and startup for stdio transport
 */
export async function startStdioServer(): Promise<void> {
  const logger = createLogger("azure-logs-mcp-stdio");
  
  try {
    // Validate environment on startup
    validateEnvironment();

    // Perform health checks
    await performStartupChecks();

    // Create the MCP server
    const server = createMcpServer("stdio");

    // Start the MCP server with stdio transport
    const transport = new StdioServerTransport();

    logger.info("Azure Logs MCP Server starting...");
    logger.info("Tool available: getRequestLogsByOrderNumber");
    logger.info("Transport: stdio");

    await server.connect(transport);

    // Handle graceful shutdown
    const shutdown = createShutdownHandler("stdio", async () => {
      await server.close();
    });

    setupGracefulShutdown(shutdown);

    logger.info("Azure Logs MCP Server started successfully");
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}