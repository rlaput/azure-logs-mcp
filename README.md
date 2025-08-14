# Azure Logs MCP

A TypeScript-based MCP (Model Context Protocol) server that provides tools to fetch logs from Azure Application Insights based on order numbers. This service queries Azure Monitor logs using the Azure SDK and exposes the functionality through MCP tools for use with compatible clients.

## Features

- 🔒 **Security**: Input validation, sanitization, and rate limiting
- 📝 **TypeScript**: Full type safety and modern development experience
- 🚀 **Performance**: Efficient querying with timeouts and error handling
- 📊 **Logging**: Structured logging with configurable levels
- 🛡️ **Validation**: Comprehensive input validation using Zod schemas
- ⚡ **Rate Limiting**: Built-in protection against API abuse

## Prerequisites

Before using this application, you need to set up the following in Azure:

### 1. Create a Service Principal

1. Navigate to the Azure Portal
2. Go to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Provide a name for your application (e.g., "Azure Logs MCP")
5. Select the appropriate account types
6. Click **Register**
7. Note down the **Application (client) ID** and **Directory (tenant) ID**
8. Go to **Certificates & secrets** > **Client secrets**
9. Click **New client secret**
10. Add a description and set expiration
11. Click **Add** and copy the **Value** (this is your client secret)

### 2. Grant Monitoring Reader Permissions

1. Navigate to your **Application Insights** resource in the Azure Portal
2. Go to **Access control (IAM)**
3. Click **Add** > **Add role assignment**
4. Select **Monitoring Reader** role
5. In the **Members** tab, search for and select your Service Principal
6. Click **Review + assign**

### 3. Get Application Insights Workspace ID

1. Navigate to your **Application Insights** resource
2. Go to **Properties**
3. Copy the **Workspace ID** (this will be used as `AZURE_MONITOR_WORKSPACE_ID`)

## Configuration

1. Copy the environment variables template:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your Azure credentials:

   - **AZURE_CLIENT_ID**: The Application (client) ID from your Service Principal
   - **AZURE_TENANT_ID**: The Directory (tenant) ID from your Azure AD
   - **AZURE_CLIENT_SECRET**: The client secret value you created
   - **AZURE_MONITOR_WORKSPACE_ID**: The Workspace ID from your Application Insights resource

## Installation

Install the required dependencies:

```bash
npm install
```

## Development

### Building the Project

Compile TypeScript to JavaScript:

```bash
npm run build
```

### Development Mode

Run the server in development mode with hot reloading:

```bash
npm run dev
```

### Production Mode

Build and start the server:

```bash
npm run build
npm start
```

### Code Quality

Type check the code:

```bash
npm run type-check
```

Lint the code:

```bash
npm run lint
```

Clean build artifacts:

```bash
npm run clean
```

## Container Deployment

This MCP server supports containerization with Docker and includes both stdio and SSE transport modes.

### Quick Start with Docker

```bash
# Build and run with Docker Compose
npm run docker:compose

# Or build and run manually
npm run docker:build
npm run docker:run
```

### Transport Modes

- **stdio mode** (default): Traditional MCP protocol for direct connections
- **SSE mode**: Web-based transport for browser clients and remote connections

```bash
# Run SSE mode (web server on port 3000)
docker run --env-file .env -e TRANSPORT_MODE=sse -p 3000:3000 azure-logs-mcp

# Run stdio mode (direct process communication)
docker run --env-file .env -e TRANSPORT_MODE=stdio azure-logs-mcp
```

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

## MCP Server Usage

### Server Connection

**Server Name:** Azure Logs MCP

**Transport:** stdio (standard MCP protocol)

**Connection Command:**
```bash
node dist/index.js
```

Or for development:
```bash
npm run dev
```

### Available Tools

#### getLogsByOrderNumber

**Description:** Retrieves logs from Azure Application Insights that contain the specified order number in the request name, URL, or custom dimensions.

**Parameters:**
- `orderNumber` (required): The order number to search for in the logs
  - Type: string
  - Format: Alphanumeric characters, hyphens, and underscores only
  - Length: 1-50 characters
  - Pattern: `^[A-Za-z0-9\-_]+$`

**Security Features:**
- Input validation and sanitization
- Rate limiting (10 requests per minute per client)
- Error message sanitization
- Query timeout protection

**Query Details:**
- Searches logs from the last 30 days
- Looks for the order number in request names, URLs, and custom dimensions
- Returns up to 100 results ordered by timestamp (most recent first)
- Query timeout is set to 30 minutes
- Uses parameterized queries to prevent injection attacks

**Response:**
The tool returns query results from Application Insights, including:
- `timestamp`: When the request occurred
- `name`: The request name
- `url`: The request URL
- `resultCode`: HTTP response code
- `duration`: Request duration
- `customDimensions`: Additional custom data

**Rate Limiting:**
- Maximum 10 requests per minute per client
- Automatic cleanup of expired rate limit entries
- Graceful error messages when limits are exceeded

## Error Handling

The server includes comprehensive error handling:

- **Validation Errors**: Input validation with detailed error messages
- **Configuration Errors**: Missing environment variables detected on startup
- **Query Errors**: Azure API failures with sanitized error messages
- **Rate Limiting**: Graceful handling of rate limit exceeded scenarios
- **Timeout Protection**: Query timeouts to prevent hanging requests
- **Structured Logging**: All errors logged with context and timestamps

### Error Types

1. **ValidationError**: Invalid input format or missing required fields
2. **ConfigurationError**: Missing or invalid environment configuration
3. **QueryError**: Azure Application Insights query failures
4. **Rate Limit Exceeded**: Too many requests from a single client

### Security

- Error messages are sanitized to prevent information disclosure
- Sensitive information is redacted from logs
- Input validation prevents injection attacks
- Rate limiting protects against abuse

## Dependencies

### Runtime Dependencies
- **@azure/identity**: Azure authentication library
- **@azure/monitor-query**: Azure Monitor query client
- **@modelcontextprotocol/sdk**: Official MCP SDK
- **dotenv**: Environment variable management
- **zod**: Runtime type validation and parsing

### Development Dependencies
- **typescript**: TypeScript compiler and language support
- **@types/node**: Node.js type definitions
- **tsx**: TypeScript execution for development
- **eslint**: Code linting and style enforcement
- **@typescript-eslint/**: TypeScript-specific ESLint rules
- **rimraf**: Cross-platform file deletion utility

## Project Structure

```
azure-logs-mcp/
├── src/                    # TypeScript source files
│   ├── index.ts           # Main server entry point
│   ├── appinsights.ts     # Azure Application Insights integration
│   ├── types.ts           # Type definitions and schemas
│   └── utils.ts           # Utility functions (logging, rate limiting)
├── dist/                  # Compiled JavaScript output
├── package.json           # Project configuration and dependencies
├── tsconfig.json          # TypeScript configuration
├── .eslintrc.json         # ESLint configuration
├── .env.example           # Environment variables template
└── README.md              # This file
```

## Environment Variables

All environment variables are validated on startup. Missing required variables will cause the server to exit with an error.

### Required Variables
- `AZURE_CLIENT_ID`: Application (client) ID from your Service Principal
- `AZURE_TENANT_ID`: Directory (tenant) ID from your Azure AD
- `AZURE_CLIENT_SECRET`: Client secret value you created
- `AZURE_MONITOR_WORKSPACE_ID`: Workspace ID from your Application Insights resource

### Optional Variables
- `NODE_ENV`: Set to 'development' for debug logging (default: 'production')
- `LOG_LEVEL`: Override default log level
  - `0` = ERROR (only error messages)
  - `1` = WARN (warnings and errors)
  - `2` = INFO (info, warnings, and errors) - default for production
  - `3` = DEBUG (all messages) - default for development

## Health Checks

The server includes a health check function that verifies Azure connectivity on startup:

```typescript
import { healthCheck } from './appinsights';

try {
  await healthCheck();
  console.log('Azure connection verified');
} catch (error) {
  console.error('Health check failed:', error);
}
```

## Logging

The server uses structured logging with configurable levels. You can control the log level using the `LOG_LEVEL` environment variable:

```bash
# Set log level to DEBUG for development
export LOG_LEVEL=3
npm run dev

# Set log level to ERROR for production (only errors)
export LOG_LEVEL=0
npm start
```

Log levels:
- `0` = ERROR: Only critical errors
- `1` = WARN: Warnings and errors
- `2` = INFO: General information, warnings, and errors (default for production)
- `3` = DEBUG: All messages including debug information (default for development)

## Container Support

### Available Scripts

```bash
# Development
npm run dev          # Run stdio mode in development
npm run dev:sse      # Run SSE mode in development

# Production
npm run start        # Run stdio mode in production
npm run start:sse    # Run SSE mode in production

# Docker
npm run docker:build    # Build Docker image
npm run docker:run      # Run container with .env file
npm run docker:compose  # Run with docker-compose
```

### SSE Mode Features

When running in SSE mode, the server provides:

- **SSE Endpoint**: `GET /sse` - MCP Server-Sent Events endpoint
- **Health Check**: `GET /health` - Service health verification
- **CORS Support**: Configurable cross-origin resource sharing
- **Web Integration**: Compatible with browser-based MCP clients

### Container Configuration

Additional environment variables for containerized deployments:

- `PORT`: Server port (default: 3000)
- `TRANSPORT_MODE`: 'sse' or 'stdio' (default: sse)
- `CORS_ORIGIN`: Allowed CORS origins (default: *)

For comprehensive deployment guidance, see [DEPLOYMENT.md](DEPLOYMENT.md).