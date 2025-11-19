import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { searchLogs } from './appinsights';
import { rateLimiter, createLogger, RateLimiter } from './utils';
import {
  ValidationError as ValidationErrorClass,
  ConfigurationError as ConfigurationErrorClass,
  SearchLogsSchema,
} from './types';

/**
 * Validates environment variables on startup
 * @throws ConfigurationError if required variables are missing
 */
export function validateEnvironment(): void {
  const logger = createLogger('server-common');
  const required = [
    'AZURE_CLIENT_ID',
    'AZURE_TENANT_ID',
    'AZURE_CLIENT_SECRET',
    'AZURE_MONITOR_WORKSPACE_ID',
  ];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(
      ', ',
    )}`;
    logger.error(message);
    logger.error(
      'Please check your .env file and ensure all required variables are set.',
    );
    throw new ConfigurationErrorClass(message);
  }

  logger.info('Environment validation successful');
}

/**
 * Sanitizes error messages for client responses
 * @param error - The error to sanitize
 * @param context - Additional context for logging
 * @returns Sanitized error message safe for client consumption
 */
export function sanitizeError(error: unknown, context = ''): string {
  const logger = createLogger('server-common');
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error(`Error in ${context}:`, {
    message: errorMessage,
    stack: errorStack,
    timestamp: new Date().toISOString(),
    type: error instanceof Error ? error.constructor.name : 'Unknown',
  });

  // Return validation errors as they are safe to expose
  if (
    error instanceof ValidationErrorClass ||
    error instanceof ConfigurationErrorClass ||
    (error instanceof Error &&
      (error.message.includes('Invalid search term') ||
        error.message.includes('Search term') ||
        error.message.includes('validation')))
  ) {
    return errorMessage;
  }

  // Return generic error message for other errors
  return 'An error occurred while processing your request. Please try again later.';
}

/**
 * Performs startup health checks
 */
export async function performStartupChecks(): Promise<void> {
  const logger = createLogger('server-common');
  try {
    logger.info('Performing startup health checks...');
    const { healthCheck } = await import('./appinsights');
    await healthCheck();
    logger.info('Health checks passed successfully');
  } catch (error) {
    logger.error('Health check failed during startup:', error);
    // Don't exit on health check failure, but log the warning
    logger.warn(
      'Server starting despite health check failure. Some functionality may be limited.',
    );
  }
}

/**
 * Creates the tool handler for searchLogs
 * @param serverType - Type of server for logging context
 * @returns Tool handler function
 */
export function createSearchLogsToolHandler(serverType: string) {
  const logger = createLogger(`${serverType}-tool`);

  return async ({
    searchTerm,
    limit = 50,
    duration = 'P7D',
  }: {
    searchTerm: string;
    limit?: number;
    duration?: string;
  }) => {
    // Apply rate limiting with proper client identification
    const clientId = RateLimiter.extractClientId();
    if (!rateLimiter.checkLimit(clientId)) {
      logger.warn(`Rate limit exceeded for client: ${clientId}`);
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Rate limit exceeded. Please wait before making another request.',
          },
        ],
        isError: true,
      };
    }

    try {
      logger.info('Executing searchLogs', {
        searchTerm: '[REDACTED]',
        clientId: serverType === 'sse' ? clientId : undefined,
      });

      const logs = await searchLogs(
        searchTerm,
        limit,
        duration,
      );
      const resultCount = logs.tables?.[0]?.rows?.length || 0;

      const successMessage =
        serverType === 'sse'
          ? `Successfully retrieved ${resultCount} log entries for client: ${clientId}`
          : `Successfully retrieved ${resultCount} log entries`;

      logger.info(successMessage);

      // Return proper MCP content format
      return {
        content: [
          {
            type: 'text' as const,
            text: `Successfully retrieved ${resultCount} log entries for search term: ${searchTerm}\n\n${JSON.stringify(
              logs,
              null,
              2,
            )}`,
          },
        ],
      };
    } catch (error) {
      const sanitizedError = sanitizeError(
        error,
        'searchLogs',
      );
      logger.error('Tool execution failed', {
        error: sanitizedError,
        clientId: serverType === 'sse' ? clientId : undefined,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to fetch logs: ${sanitizedError}`,
          },
        ],
        isError: true,
      };
    }
  };
}

/**
 * Registers the Azure logs tool on an MCP server
 * @param server - The MCP server instance
 * @param serverType - Type of server for logging context
 */
export function registerAzureLogsTool(
  server: McpServer,
  serverType: string,
): void {
  const toolHandler = createSearchLogsToolHandler(serverType);

  server.registerTool(
    'searchLogs',
    {
      title: 'Search Logs',
      description:
        'Searches request logs from Azure Application Insights by a search term (e.g., order number, transaction ID). Searches through request logs containing the term in name, URL, or custom dimensions.',
      inputSchema: SearchLogsSchema.shape,
    },
    toolHandler,
  );
}

/**
 * Creates a configured MCP server instance
 * @param serverType - Type of server for logging context
 * @returns Configured MCP server
 */
export function createMcpServer(serverType: string): McpServer {
  const server = new McpServer({
    name: 'azure-logs-mcp',
    version: '1.0.0',
  });

  // Register the Azure logs tool
  registerAzureLogsTool(server, serverType);

  return server;
}

/**
 * Creates a graceful shutdown handler
 * @param serverType - Type of server for logging context
 * @param cleanupFn - Optional cleanup function to call before shutdown
 * @returns Shutdown handler function
 */
export function createShutdownHandler(
  serverType: string,
  cleanupFn?: () => Promise<void>,
) {
  const logger = createLogger(`${serverType}-shutdown`);

  return async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down Azure Logs MCP Server...`);
    try {
      if (cleanupFn) {
        await cleanupFn();
      }
      logger.info('Server shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };
}

/**
 * Sets up graceful shutdown handlers
 * @param shutdownHandler - The shutdown handler function
 */
export function setupGracefulShutdown(
  shutdownHandler: (signal: string) => Promise<void>,
): void {
  process.on('SIGINT', () => shutdownHandler('SIGINT'));
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
}
