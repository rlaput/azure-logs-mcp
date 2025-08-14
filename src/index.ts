import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { getLogsByOrderNumber, healthCheck } from './appinsights';
import { rateLimiter, createLogger } from './utils';
import type { ToolDefinition } from './types';
import {
  GetLogsByOrderNumberSchema,
  ValidationError as ValidationErrorClass,
  ConfigurationError as ConfigurationErrorClass
} from './types';

// Initialize logger
const logger = createLogger('azure-logs-mcp');

// Tool definition constant to avoid duplication
const TOOL_DEFINITION: ToolDefinition = {
  name: "getLogsByOrderNumber",
  description: "Retrieves logs from Azure Application Insights by order number. Searches through request logs containing the order number in name, URL, or custom dimensions.",
  inputSchema: {
    type: "object",
    properties: {
      orderNumber: {
        type: "string",
        description: "The order number to search for in the Azure Application Insights logs",
        pattern: "^[A-Za-z0-9\\-_]+$",
        minLength: 1,
        maxLength: 50
      }
    },
    required: ["orderNumber"]
  }
};

/**
 * Validates environment variables on startup
 * @throws ConfigurationError if required variables are missing
 */
function validateEnvironment(): void {
  const required = ['AZURE_CLIENT_ID', 'AZURE_TENANT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_MONITOR_WORKSPACE_ID'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;
    logger.error(message);
    logger.error('Please check your .env file and ensure all required variables are set.');
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
function sanitizeError(error: unknown, context = ''): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  logger.error(`Error in ${context}:`, {
    message: errorMessage,
    stack: errorStack,
    timestamp: new Date().toISOString(),
    type: error instanceof Error ? error.constructor.name : 'Unknown'
  });
  
  // Return validation errors as they are safe to expose
  if (error instanceof ValidationErrorClass || 
      error instanceof ConfigurationErrorClass ||
      (error instanceof Error && (
        error.message.includes('Invalid order number') || 
        error.message.includes('Order number') ||
        error.message.includes('validation')
      ))) {
    return errorMessage;
  }
  
  // Return generic error message for other errors
  return 'An error occurred while processing your request. Please try again later.';
}

/**
 * Performs startup health checks
 */
async function performStartupChecks(): Promise<void> {
  try {
    logger.info('Performing startup health checks...');
    await healthCheck();
    logger.info('Health checks passed successfully');
  } catch (error) {
    logger.error('Health check failed during startup:', error);
    // Don't exit on health check failure, but log the warning
    logger.warn('Server starting despite health check failure. Some functionality may be limited.');
  }
}

/**
 * Main server initialization and startup
 */
async function main(): Promise<void> {
  try {
    // Validate environment on startup
    validateEnvironment();
    
    // Perform health checks
    await performStartupChecks();
    
    // Create the MCP server
    const server = new Server(
      {
        name: "azure-logs-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // List available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('Received tools list request');
      return {
        tools: [TOOL_DEFINITION]
      };
    });

    // Handle tool calls with rate limiting
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      logger.info(`Received tool call: ${name}`, { args: args ? '[REDACTED]' : 'none' });
      
      // Apply rate limiting
      const clientId = 'default'; // In a real implementation, extract from request context
      if (!rateLimiter.checkLimit(clientId)) {
        logger.warn(`Rate limit exceeded for client: ${clientId}`);
        return {
          content: [
            {
              type: "text",
              text: "Rate limit exceeded. Please wait before making another request."
            }
          ],
          isError: true
        };
      }
      
      if (name === "getLogsByOrderNumber") {
        try {
          // Validate input using Zod schema
          const validatedInput = GetLogsByOrderNumberSchema.parse(args);
          const { orderNumber } = validatedInput;
          
          logger.info('Executing getLogsByOrderNumber', { orderNumber: '[REDACTED]' });
          
          const logs = await getLogsByOrderNumber(orderNumber);
          const resultCount = logs.tables?.[0]?.rows?.length || 0;
          
          logger.info(`Successfully retrieved ${resultCount} log entries`);
          
          // Return proper MCP content format
          return {
            content: [
              {
                type: "text",
                text: `Successfully retrieved ${resultCount} log entries for order number: ${orderNumber}`
              },
              {
                type: "text",
                text: JSON.stringify(logs, null, 2)
              }
            ]
          };
        } catch (error) {
          const sanitizedError = sanitizeError(error, 'getLogsByOrderNumber');
          logger.error('Tool execution failed', { error: sanitizedError });
          
          return {
            content: [
              {
                type: "text",
                text: `Failed to fetch logs: ${sanitizedError}`
              }
            ],
            isError: true
          };
        }
      } else {
        const errorMessage = `Unknown tool: ${name}`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
      }
    });

    // Start the MCP server with stdio transport
    const transport = new StdioServerTransport();
    
    logger.info('Azure Logs MCP Server starting...');
    logger.info('Tool available: getLogsByOrderNumber');
    logger.info('Transport: stdio');
    
    await server.connect(transport);
    
    // Handle graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, shutting down Azure Logs MCP Server...`);
      try {
        await server.close();
        logger.info('Server shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };
    
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    logger.info('Azure Logs MCP Server started successfully');
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error('Unhandled error during startup:', error);
  process.exit(1);
});