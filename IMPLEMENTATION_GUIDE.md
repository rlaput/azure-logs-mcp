# Azure Logs MCP Server - Implementation Guide

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
  "getLogsByOrderNumber",
  {
    title: "Get Logs by Order Number",
    description: "Retrieves logs from Azure Application Insights",
    inputSchema: {
      orderNumber: z.string().min(1).max(50).regex(/^[A-Za-z0-9\-_]+$/)
    }
  },
  async ({ orderNumber }) => {
    // Tool implementation
  }
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

| Feature | Stdio Server | HTTP Server |
|---------|--------------|-------------|
| **Transport** | Stdio | Streamable HTTP |
| **Browser Support** | ❌ | ✅ |
| **Session Management** | N/A | ✅ Automatic |
| **CORS Support** | N/A | ✅ |
| **Rate Limiting** | ✅ | ✅ |
| **Type Safety** | ✅ Excellent | ✅ Excellent |
| **Maintainability** | ✅ High | ✅ High |
| **Performance** | ✅ Excellent | ✅ Excellent |
| **Use Case** | CLI/Desktop | Web/Container |

## 🛡️ **Security Features**

### Input Validation
```typescript
// Zod schema validation
orderNumber: z.string()
  .min(1, "Order number cannot be empty")
  .max(50, "Order number too long")
  .regex(/^[A-Za-z0-9\-_]+$/, "Invalid format")
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