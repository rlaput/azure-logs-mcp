import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { getRequestLogsByOrderNumber, healthCheck } from "./appinsights";
import { rateLimiter, createLogger, RateLimiter } from "./utils";
import {
  ValidationError as ValidationErrorClass,
  ConfigurationError as ConfigurationErrorClass,
  GetLogsByOrderNumberSchema,
} from "./types";
import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";

// Initialize logger
const logger = createLogger("azure-logs-mcp-sse");

/**
 * Validates environment variables on startup
 * @throws ConfigurationError if required variables are missing
 */
function validateEnvironment(): void {
  const required = [
    "AZURE_CLIENT_ID",
    "AZURE_TENANT_ID",
    "AZURE_CLIENT_SECRET",
    "AZURE_MONITOR_WORKSPACE_ID",
  ];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(
      ", "
    )}`;
    logger.error(message);
    logger.error(
      "Please check your .env file and ensure all required variables are set."
    );
    throw new ConfigurationErrorClass(message);
  }

  logger.info("Environment validation successful");
}

/**
 * Sanitizes error messages for client responses
 * @param error - The error to sanitize
 * @param context - Additional context for logging
 * @returns Sanitized error message safe for client consumption
 */
function sanitizeError(error: unknown, context = ""): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error(`Error in ${context}:`, {
    message: errorMessage,
    stack: errorStack,
    timestamp: new Date().toISOString(),
    type: error instanceof Error ? error.constructor.name : "Unknown",
  });

  // Return validation errors as they are safe to expose
  if (
    error instanceof ValidationErrorClass ||
    error instanceof ConfigurationErrorClass ||
    (error instanceof Error &&
      (error.message.includes("Invalid order number") ||
        error.message.includes("Order number") ||
        error.message.includes("validation")))
  ) {
    return errorMessage;
  }

  // Return generic error message for other errors
  return "An error occurred while processing your request. Please try again later.";
}

/**
 * Performs startup health checks
 */
async function performStartupChecks(): Promise<void> {
  try {
    logger.info("Performing startup health checks...");
    await healthCheck();
    logger.info("Health checks passed successfully");
  } catch (error) {
    logger.error("Health check failed during startup:", error);
    // Don't exit on health check failure, but log the warning
    logger.warn(
      "Server starting despite health check failure. Some functionality may be limited."
    );
  }
}

/**
 * Create and configure the MCP server
 */
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "azure-logs-mcp",
    version: "1.0.0",
  });

  // Register the Azure logs tool using the modern API
  server.registerTool(
    "getRequestLogsByOrderNumber",
    {
      title: "Get Request Logs by Order Number",
      description:
        "Retrieves request logs from Azure Application Insights by order number. Searches through request logs containing the order number in name, URL, or custom dimensions.",
      inputSchema: GetLogsByOrderNumberSchema.shape,
    },
    async ({ orderNumber, limit = 50, duration = "P7D" }) => {
      // Apply rate limiting with default client identification
      const clientId = RateLimiter.extractClientId();
      if (!rateLimiter.checkLimit(clientId)) {
        logger.warn(`Rate limit exceeded for client: ${clientId}`);
        return {
          content: [
            {
              type: "text",
              text: "Rate limit exceeded. Please wait before making another request.",
            },
          ],
          isError: true,
        };
      }

      try {
        logger.info("Executing getRequestLogsByOrderNumber", {
          orderNumber: "[REDACTED]",
          clientId,
        });

        const logs = await getRequestLogsByOrderNumber(orderNumber, limit, duration);
        const resultCount = logs.tables?.[0]?.rows?.length || 0;

        logger.info(
          `Successfully retrieved ${resultCount} log entries for client: ${clientId}`
        );

        // Return proper MCP content format
        return {
          content: [
            {
              type: "text",
              text: `Successfully retrieved ${resultCount} log entries for order number: ${orderNumber}\n\n${JSON.stringify(
                logs,
                null,
                2
              )}`,
            },
          ],
        };
      } catch (error) {
        const sanitizedError = sanitizeError(error, "getRequestLogsByOrderNumber");
        logger.error("Tool execution failed", {
          error: sanitizedError,
          clientId,
        });

        return {
          content: [
            {
              type: "text",
              text: `Failed to fetch logs: ${sanitizedError}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

/**
 * Main server initialization and startup for HTTP transport
 */
async function main(): Promise<void> {
  try {
    // Validate environment on startup
    validateEnvironment();

    // Perform health checks
    await performStartupChecks();

    // Create Express app
    const app = express();
    const port = parseInt(process.env["PORT"] || "3000", 10);

    // Middleware
    app.use(
      cors({
        origin: process.env["CORS_ORIGIN"] || "*",
        credentials: true,
        exposedHeaders: ["Mcp-Session-Id"],
        allowedHeaders: ["Content-Type", "mcp-session-id", "x-client-id"],
      })
    );
    app.use(express.json());

    // Map to store transports by session ID
    const transports: { [sessionId: string]: StreamableHTTPServerTransport } =
      {};

    // Health check endpoint
    app.get("/health", async (req: express.Request, res: express.Response) => {
      try {
        await healthCheck();
        res.json({ status: "healthy", timestamp: new Date().toISOString() });
      } catch (error) {
        logger.error("Health check failed:", error);
        res.status(503).json({
          status: "unhealthy",
          error: "Azure connectivity check failed",
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Handle MCP requests using modern API
    app.all("/mcp", async (req: express.Request, res: express.Response) => {
      try {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
          // Reuse existing transport
          transport = transports[sessionId];
        } else {
          // Create new transport
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sessionId) => {
              transports[sessionId] = transport;
              logger.info(`New MCP session initialized: ${sessionId}`);
            },
            enableDnsRebindingProtection: false, // Set to true in production
          });

          // Clean up transport when closed
          transport.onclose = () => {
            if (transport.sessionId) {
              delete transports[transport.sessionId];
              logger.info(`MCP session closed: ${transport.sessionId}`);
            }
          };

          // Create and connect the MCP server
          const server = createMcpServer();
          await server.connect(transport);
        }

        // Handle the request
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        logger.error("Error handling MCP request:", error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal server error",
            },
            id: null,
          });
        }
      }
    });

    // Root endpoint with API information
    app.get("/", (req: express.Request, res: express.Response) => {
      res.json({
        name: "Azure Logs MCP Server",
        version: "1.0.0",
        transport: "http",
        endpoints: {
          health: "/health",
          mcp: "/mcp",
        },
        tools: ["getRequestLogsByOrderNumber"],
      });
    });

    // Start the HTTP server
    app.listen(port, () => {
      logger.info(`Azure Logs MCP Server started successfully on port ${port}`);
      logger.info("Available endpoints:");
      logger.info(`  - Root: http://localhost:${port}/`);
      logger.info(`  - MCP: http://localhost:${port}/mcp`);
      logger.info(`  - Health: http://localhost:${port}/health`);
      logger.info("Tool available: getRequestLogsByOrderNumber");
      logger.info("Using McpServer API with Streamable HTTP transport");
    });

    // Handle graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, shutting down Azure Logs MCP Server...`);
      try {
        // Close all active transports
        for (const [sessionId, transport] of Object.entries(transports)) {
          try {
            await transport.close();
            logger.info(`Closed transport for session: ${sessionId}`);
          } catch (error) {
            logger.error(
              `Error closing transport for session ${sessionId}:`,
              error
            );
          }
        }
        logger.info("Server shutdown complete");
        process.exit(0);
      } catch (error) {
        logger.error("Error during shutdown:", error);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error("Unhandled error during startup:", error);
  process.exit(1);
});
