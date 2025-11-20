# Azure Logs MCP Server - Implementation Guide

## Table of Contents

- [Server Implementations](#-server-implementations)
  - [Stdio Server (`src/index.ts`)](#1--stdio-server-srcindexts)
  - [HTTP Server (`src/sse-server.ts`)](#2--http-server-srcsse-serverts--recommended-for-web)
- [Key Features Implemented](#-key-features-implemented)
  - [Enhanced Rate Limiting](#1--enhanced-rate-limiting)
  - [Modern MCP API](#2--modern-mcp-api)
  - [Security Enhancements](#3--security-enhancements)
  - [Protocol Compliance](#4--protocol-compliance)
- [Comparison Matrix](#-comparison-matrix)
- [Security Features](#-security-features)
- [Containerization](#-containerization)
- [Performance Optimizations](#-performance-optimizations)
- [Future Enhancements](#-future-enhancements)
- [Development Workflow](#-development-workflow)
- [Recommendations](#-recommendations)
- [Quick Start](#-quick-start)
  - [CLI Integration](#cli-integration)
  - [Web Integration](#web-integration)
  - [Container Deployment](#container-deployment)

## 🚀 **Server Implementations**

This project provides **two MCP server implementations** for different deployment scenarios:

### 1. **Stdio Server** (`src/index.ts`)

- ✅ **McpServer API** - clean, maintainable implementation
- ✅ Stdio transport for CLI integration
- ✅ Simplified tool registration with Zod schemas
- ✅ Enhanced rate limiting and error handling
- 🎯 **Use case**: CLI integrations, development tools, desktop applications

**Run with:**

```bash
npm run dev      # Development
npm run start    # Production
```

### 2. **HTTP Server** (`src/sse-server.ts`) ⭐ **RECOMMENDED FOR WEB**

- ✅ **McpServer API** with HTTP transport
- ✅ **Streamable HTTP transport** (latest MCP protocol)
- ✅ Session management with automatic cleanup
- ✅ Enhanced security and CORS configuration
- ✅ Production-ready with proper error handling
- 🎯 **Use case**: Production HTTP deployments, web integrations, containerized apps

**Run with:**

```bash
npm run dev:sse    # Development
npm run start:sse  # Production
```

## 🔧 **Key Features Implemented**

### 1. **Enhanced Rate Limiting**

- ✅ **Per-client identification** using headers or IP address
- ✅ **Configurable limits** (10 requests/minute by default)
- ✅ **Automatic cleanup** of expired entries

```typescript
// Extracts client ID from request headers or IP
const clientId = RateLimiter.extractClientId(req);
if (!rateLimiter.checkLimit(clientId)) {
  // Rate limit exceeded
}
```

### 2. **Modern MCP API**

- ✅ **Simplified tool registration** with `registerTool()`
- ✅ **Built-in Zod validation** for input schemas
- ✅ **Better error handling** and type safety
- ✅ **Cleaner code structure** and maintainability

```typescript
server.registerTool(
  'searchLogs',
  {
    title: 'Search Logs',
    description: 'Searches request logs from Azure Log Analytics Workspace',
    inputSchema: {
      searchTerm: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[A-Za-z0-9\-_.]+$/),
      limit: z.number().int().min(1).max(1000).default(50),
      duration: z
        .string()
        .regex(/^P(\d+D|T\d+H|\d+DT\d+H)$/)
        .default('P7D'),
    },
  },
  async ({ searchTerm, limit = 50, duration = 'P7D' }) => {
    // Tool implementation with configurable limit and duration
  },
);
```

### 3. **Security Enhancements**

- ✅ **Input sanitization** prevents injection attacks
- ✅ **Error message sanitization** prevents information leakage
- ✅ **Environment validation** ensures required credentials
- ✅ **TypeScript strict mode** for compile-time safety

### 4. **Protocol Compliance**

- ✅ **Proper MCP response format** (single content block)
- ✅ **Correct capabilities declaration** (`tools: { listChanged: true }`)
- ✅ **Standard error handling** with appropriate error codes

## 📊 **Comparison Matrix**

| Feature                | Stdio Server | HTTP Server     |
| ---------------------- | ------------ | --------------- |
| **Transport**          | Stdio        | Streamable HTTP |
| **Browser Support**    | ❌           | ✅              |
| **Session Management** | N/A          | ✅ Automatic    |
| **CORS Support**       | N/A          | ✅              |
| **Rate Limiting**      | ✅           | ✅              |
| **Type Safety**        | ✅ Excellent | ✅ Excellent    |
| **Maintainability**    | ✅ High      | ✅ High         |
| **Performance**        | ✅ Excellent | ✅ Excellent    |
| **Use Case**           | CLI/Desktop  | Web/Container   |

## 🛡️ **Security Features**

### Input Validation

```typescript
// Zod schema validation with new parameters
searchTerm: z.string()
  .min(1, "Search term cannot be empty")
  .max(100, "Search term too long")
  .regex(/^[A-Za-z0-9\-_.]+$/, "Invalid format"),
limit: z.number()
  .int("Limit must be an integer")
  .min(1, "Limit must be at least 1")
  .max(1000, "Limit cannot exceed 1000")
  .default(50),
duration: z.string()
  .regex(/^P(\d+D|T\d+H|\d+DT\d+H)$/, "Duration must be in ISO 8601 format")
  .default("P7D")
```

### Rate Limiting

```typescript
// Per-client rate limiting
const clientId = RateLimiter.extractClientId(req);
// 10 requests per minute per client
```

### Error Sanitization

```typescript
// Prevents sensitive information leakage
function sanitizeError(error: unknown): string {
  // Returns safe error messages only
}
```

## 🐳 **Containerization**

The project includes Docker support using the HTTP server for web deployments:

```bash
# Build and run with Docker
npm run docker:build
npm run docker:run

# Or use Docker Compose
npm run docker:compose
```

The container exposes port 3000 and uses the HTTP server implementation for maximum compatibility with web-based MCP clients.

## 📈 **Performance Optimizations**

1. **Connection Pooling**: Reuse Azure client connections
2. **Rate Limiting**: Prevent abuse and ensure fair usage
3. **Session Management**: Efficient HTTP session handling
4. **Memory Management**: Automatic cleanup of expired sessions
5. **Error Caching**: Prevent repeated failed requests

## 🔮 **Future Enhancements**

- [ ] **Metrics Collection**: Prometheus/OpenTelemetry integration
- [ ] **Caching Layer**: Redis for query result caching
- [ ] **Authentication**: OAuth2/JWT token validation
- [ ] **Multi-tenant Support**: Workspace isolation
- [ ] **Query Optimization**: Smart query building
- [ ] **Real-time Streaming**: WebSocket support for live logs

## 📝 **Development Workflow**

1. **Choose Implementation**:
   - Use **Stdio** for CLI tools and desktop applications
   - Use **HTTP** for web applications and containerized deployments
2. **Environment Setup**: Copy `.env.example` to `.env`
3. **Development**: Use `npm run dev` or `npm run dev:sse`
4. **Testing**: Validate with MCP clients
5. **Production**: Use `npm run start` or `npm run start:sse`

## 🎯 **Recommendations**

- **For CLI tools**: Use `src/index.ts` (Stdio Server)
- **For web apps**: Use `src/sse-server.ts` (HTTP Server)
- **For containers**: Use HTTP Server (already configured in Dockerfile)
- **For new projects**: Both implementations use the modern McpServer API

Both implementations provide excellent developer experience, enhanced security, and improved maintainability while maintaining full MCP protocol compliance.

## 🚀 **Quick Start**

### CLI Integration

```bash
npm run dev
# Server starts on stdio transport
```

### Web Integration

```bash
npm run dev:sse
# Server starts on http://localhost:3000
```

### Container Deployment

```bash
docker-compose up --build
# Server available at http://localhost:3000
```

The implementations are production-ready and include comprehensive error handling, logging, health checks, and security features.
