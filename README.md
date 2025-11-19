# Azure Logs MCP

A TypeScript-based MCP (Model Context Protocol) server that provides tools to fetch logs from Azure Log Analytics Workspace based on search terms (e.g., order numbers, transaction IDs). This service queries Azure Monitor logs using the Azure SDK and exposes the functionality through MCP tools for use with compatible clients.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
  - [Create a Service Principal](#1-create-a-service-principal)
  - [Grant Log Analytics Reader Permissions](#2-grant-log-analytics-reader-permissions)
  - [Get Log Analytics Workspace ID](#3-get-log-analytics-workspace-id)
- [Configuration](#configuration)
- [Installation](#installation)
- [Development](#development)
  - [Building the Project](#building-the-project)
  - [Development Mode](#development-mode)
  - [Production Mode](#production-mode)
  - [Code Quality](#code-quality)
- [Container Deployment](#container-deployment)
  - [Quick Start with Podman (Recommended)](#quick-start-with-podman-recommended)
  - [Quick Start with Docker](#quick-start-with-docker)
  - [OCI Compliance](#oci-compliance)
  - [Transport Modes](#transport-modes)
- [MCP Server Usage](#mcp-server-usage)
  - [Server Connection](#server-connection)
  - [Available Tools](#available-tools)
    - [searchLogs](#searchlogs)
- [Error Handling](#error-handling)
  - [Error Types](#error-types)
  - [Security](#security)
- [Dependencies](#dependencies)
  - [Runtime Dependencies](#runtime-dependencies)
  - [Development Dependencies](#development-dependencies)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
  - [Required Variables](#required-variables)
  - [Optional Variables](#optional-variables)
- [Health Checks](#health-checks)
- [Logging](#logging)
- [Container Support](#container-support)
  - [Available Scripts](#available-scripts)
  - [SSE Mode Features](#sse-mode-features)
  - [Container Configuration](#container-configuration)

## Features

- 🔒 **Security**: Input validation, sanitization, and rate limiting
- 📝 **TypeScript**: Full type safety and modern development experience
- 🚀 **Performance**: Efficient querying with timeouts and error handling
- 📊 **Logging**: Structured logging with configurable levels
- 🛡️ **Validation**: Comprehensive input validation using Zod schemas
- ⚡ **Rate Limiting**: Built-in protection against API abuse
- 🐳 **OCI Compliant**: Full Open Container Initiative compliance with Docker and Podman support
- 🔧 **Multi-Runtime**: Works with Docker, Podman, and any OCI-compatible container runtime

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

### 2. Grant Log Analytics Reader Permissions

1. Navigate to your **Log Analytics Workspace** resource in the Azure Portal
2. Go to **Access control (IAM)**
3. Click **Add** > **Add role assignment**
4. Select **Log Analytics Reader** role
5. In the **Members** tab, search for and select your Service Principal
6. Click **Review + assign**

### 3. Get Log Analytics Workspace ID

1. Navigate to your **Log Analytics Workspace** resource
2. Go to **Overview**
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
   - **AZURE_MONITOR_WORKSPACE_ID**: The Workspace ID from your Log Analytics Workspace resource

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

Run the SSE server in development mode:

```bash
npm run dev:sse
```

Run with MCP inspector for debugging:

```bash
npm run dev:inspector
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

Format the code:

```bash
npm run format
```

Clean build artifacts:

```bash
npm run clean
```

## Container Deployment

This MCP server is fully **OCI-compliant** and supports multiple container runtimes including Docker, Podman, and any OCI-compatible runtime. Both stdio and SSE transport modes are supported.

### Quick Start with Podman (Recommended)

```bash
# Build and run with Podman
npm run container:build
npm run container:run

# Or manually
podman build -f Containerfile -t azure-logs-mcp .
podman run --env-file .env -p 3000:3000 azure-logs-mcp
```

### Quick Start with Docker

```bash
# Build and run with Docker
npm run docker:build
npm run docker:run

# Or manually
docker build -f Containerfile -t azure-logs-mcp .
docker run --env-file .env -p 3000:3000 azure-logs-mcp
```

### OCI Compliance

This project follows Open Container Initiative standards:

- ✅ **Multi-runtime support**: Docker, Podman, Buildah, CRI-O, containerd
- ✅ **Rootless containers**: Enhanced security with Podman
- ✅ **OCI labels**: Proper metadata and annotations
- ✅ **Standard formats**: Containerfile and Dockerfile support

### Transport Modes

- **stdio mode** (default): Traditional MCP protocol for direct connections
- **SSE mode**: Web-based transport for browser clients and remote connections

```bash
# Podman examples
podman run --env-file .env -e TRANSPORT_MODE=sse -p 3000:3000 azure-logs-mcp
podman run --env-file .env -e TRANSPORT_MODE=stdio azure-logs-mcp

# Docker examples
docker run --env-file .env -e TRANSPORT_MODE=sse -p 3000:3000 azure-logs-mcp
docker run --env-file .env -e TRANSPORT_MODE=stdio azure-logs-mcp
```

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).
For OCI compliance details, see [OCI-COMPLIANCE.md](OCI-COMPLIANCE.md).

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

#### searchLogs

**Description:** Searches request logs from Azure Log Analytics Workspace that contain the specified search term in the request name, URL, or custom dimensions.

**Parameters:**

- `searchTerm` (required): The term to search for in the logs (e.g., order number, transaction ID)
  - Type: string
  - Format: Alphanumeric characters, hyphens, underscores, and dots only
  - Length: 1-100 characters
  - Pattern: `^[A-Za-z0-9\-_.]+$`
- `limit` (optional): Maximum number of results to return
  - Type: number
  - Range: 1-1000
  - Default: 50
- `duration` (optional): Time range for the query
  - Type: string
  - Format: ISO 8601 duration format
  - Examples: "P7D" (7 days), "PT24H" (24 hours), "P30D" (30 days)
  - Default: "P7D" (7 days)

**Security Features:**

- Input validation and sanitization
- Rate limiting (10 requests per minute per client)
- Error message sanitization
- Query timeout protection

**Query Details:**

- Searches logs from the specified duration (default: last 7 days)
- Looks for the search term in request names, URLs, and custom dimensions
- Returns up to the specified limit of results ordered by timestamp (most recent first)
- Query timeout is set to 30 minutes
- Uses parameterized queries to prevent injection attacks

**Response:**
The tool returns query results from Log Analytics Workspace, including:

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
3. **QueryError**: Azure Log Analytics Workspace query failures
4. **Rate Limit Exceeded**: Too many requests from a single client

### Security

- Error messages are sanitized to prevent information disclosure
- Sensitive information is redacted from logs
- Input validation prevents injection attacks
- Rate limiting protects against abuse

## Dependencies

### Runtime Dependencies

- **@azure/identity**: Azure authentication library
- **@azure/monitor-query-logs**: Azure Monitor logs query client
- **@modelcontextprotocol/sdk**: Official MCP SDK
- **cors**: Cross-Origin Resource Sharing middleware
- **dotenv**: Environment variable management
- **express**: Fast, unopinionated web framework for Node.js
- **zod**: Runtime type validation and parsing

### Development Dependencies

- **typescript**: TypeScript compiler and language support
- **@types/cors**: TypeScript definitions for CORS
- **@types/express**: TypeScript definitions for Express
- **@types/node**: Node.js type definitions
- **tsx**: TypeScript execution for development
- **eslint**: Code linting and style enforcement
- **@typescript-eslint/eslint-plugin**: TypeScript-specific ESLint rules
- **@typescript-eslint/parser**: TypeScript parser for ESLint
- **rimraf**: Cross-platform file deletion utility

## Project Structure

```
azure-logs-mcp/
├── src/                    # TypeScript source files
│   ├── index.ts           # Main server entry point and transport mode selector
│   ├── appinsights.ts     # Azure Log Analytics Workspace integration
│   ├── http-server.ts     # HTTP server utilities for SSE mode
│   ├── server-common.ts   # Common server functionality and tools
│   ├── sse-server.ts      # Server-Sent Events (SSE) transport mode
│   ├── stdio-server.ts    # Standard I/O transport mode
│   ├── types.ts           # Type definitions and schemas
│   └── utils.ts           # Utility functions (logging, rate limiting)
├── dist/                  # Compiled JavaScript output (generated)
├── .containerignore       # Container build ignore patterns
├── .env.example           # Environment variables template
├── .eslintrc.json         # ESLint configuration
├── .gitignore             # Git ignore patterns
├── .prettierrc            # Prettier code formatting configuration
├── Containerfile          # OCI-compliant container build instructions
├── DEPLOYMENT.md          # Detailed deployment instructions
├── IMPLEMENTATION_GUIDE.md # Implementation and development guide
├── LICENSE                # Project license
├── OCI-COMPLIANCE.md      # Open Container Initiative compliance details
├── package.json           # Project configuration and dependencies
├── package-lock.json      # Locked dependency versions
├── README.md              # This file
└── tsconfig.json          # TypeScript configuration
```

## Environment Variables

All environment variables are validated on startup. Missing required variables will cause the server to exit with an error.

### Required Variables

- `AZURE_CLIENT_ID`: Application (client) ID from your Service Principal
- `AZURE_TENANT_ID`: Directory (tenant) ID from your Azure AD
- `AZURE_CLIENT_SECRET`: Client secret value you created
- `AZURE_MONITOR_WORKSPACE_ID`: Workspace ID from your Log Analytics Workspace resource

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
npm run dev              # Run stdio mode in development
npm run dev:sse          # Run SSE mode in development
npm run dev:inspector    # Run with MCP inspector for debugging

# Production
npm run start            # Run stdio mode in production
npm run start:sse        # Run SSE mode in production

# Build and Quality
npm run build            # Compile TypeScript to JavaScript
npm run clean            # Clean build artifacts
npm run type-check       # Type check without emitting files
npm run lint             # Lint and fix TypeScript files
npm run format           # Format code with Prettier

# Container (OCI-compliant, works with any runtime)
npm run container:build  # Build with Podman (recommended)
npm run container:run    # Run with Podman

# Docker (traditional)
npm run docker:build     # Build Docker image
npm run docker:run       # Run container with .env file

# Podman (explicit)
npm run podman:build     # Build with Podman
npm run podman:run       # Run with Podman
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
- `CORS_ORIGIN`: Allowed CORS origins (default: \*)

For comprehensive deployment guidance, see [DEPLOYMENT.md](DEPLOYMENT.md).
