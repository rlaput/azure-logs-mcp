import 'dotenv/config';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createLogger } from './utils';
import {
  validateEnvironment,
  performStartupChecks,
  createMcpServer,
  createShutdownHandler,
  setupGracefulShutdown,
} from './server-common';
import { healthCheck } from './appinsights';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';

/**
 * Main server initialization and startup for HTTP transport
 */
export async function startHttpServer(): Promise<void> {
  const logger = createLogger('azure-logs-mcp-sse');

  try {
    // Validate environment on startup
    validateEnvironment();

    // Perform health checks
    await performStartupChecks();

    // Create Express app
    const app = express();
    const port = parseInt(process.env['PORT'] || '3000', 10);

    // Middleware
    app.use(
      cors({
        origin: process.env['CORS_ORIGIN'] || '*',
        credentials: true,
        exposedHeaders: ['Mcp-Session-Id'],
        allowedHeaders: ['Content-Type', 'mcp-session-id', 'x-client-id'],
      }),
    );
    app.use(express.json());

    // Map to store transports by session ID
    const transports: { [sessionId: string]: StreamableHTTPServerTransport } =
      {};

    // Health check endpoint
    app.get('/health', async (req: express.Request, res: express.Response) => {
      try {
        await healthCheck();
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
      } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          error: 'Azure connectivity check failed',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Handle MCP requests using modern API
    app.all('/mcp', async (req: express.Request, res: express.Response) => {
      try {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
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
          const server = createMcpServer('sse');
          await server.connect(transport);
        }

        // Handle the request
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        logger.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
    });

    // Root endpoint with API information
    app.get('/', (req: express.Request, res: express.Response) => {
      res.json({
        name: 'Azure Logs MCP Server',
        version: '1.0.0',
        transport: 'http',
        endpoints: {
          health: '/health',
          mcp: '/mcp',
        },
        tools: ['searchLogs'],
      });
    });

    // Start the HTTP server
    app.listen(port, () => {
      logger.info(`Azure Logs MCP Server started successfully on port ${port}`);
      logger.info('Available endpoints:');
      logger.info(`  - Root: http://localhost:${port}/`);
      logger.info(`  - MCP: http://localhost:${port}/mcp`);
      logger.info(`  - Health: http://localhost:${port}/health`);
      logger.info('Tool available: searchLogs');
      logger.info('Using McpServer API with Streamable HTTP transport');
    });

    // Handle graceful shutdown
    const shutdown = createShutdownHandler('sse', async () => {
      // Close all active transports
      for (const [sessionId, transport] of Object.entries(transports)) {
        try {
          await transport.close();
          logger.info(`Closed transport for session: ${sessionId}`);
        } catch (error) {
          logger.error(
            `Error closing transport for session ${sessionId}:`,
            error,
          );
        }
      }
    });

    setupGracefulShutdown(shutdown);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}
