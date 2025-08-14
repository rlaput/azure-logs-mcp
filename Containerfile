# Multi-stage build for optimal image size and OCI compliance
FROM node:20-alpine AS builder

# Add OCI labels for better metadata
LABEL org.opencontainers.image.title="Azure Logs MCP Server"
LABEL org.opencontainers.image.description="Model Context Protocol server for Azure Application Insights logs"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.authors="Azure Logs MCP Team"
LABEL org.opencontainers.image.source="https://github.com/your-org/azure-logs-mcp"
LABEL org.opencontainers.image.licenses="ISC"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Add OCI labels for production image
LABEL org.opencontainers.image.title="Azure Logs MCP Server"
LABEL org.opencontainers.image.description="Model Context Protocol server for Azure Application Insights logs"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.authors="Azure Logs MCP Team"
LABEL org.opencontainers.image.source="https://github.com/your-org/azure-logs-mcp"
LABEL org.opencontainers.image.licenses="ISC"

# Create non-root user for security (OCI best practice)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy environment example (for reference)
COPY .env.example ./

# Change ownership to non-root user
RUN chown -R mcp:nodejs /app
USER mcp

# Expose port (for potential SSE transport)
EXPOSE 3000

# Health check (OCI compliant)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('./dist/appinsights').healthCheck().then(() => process.exit(0)).catch(() => process.exit(1))"

# Environment variables for container configuration
ENV NODE_ENV=production
ENV LOG_LEVEL=2
ENV PORT=3000
ENV TRANSPORT_MODE=sse

# Use exec form for better signal handling (OCI best practice)
CMD ["sh", "-c", "if [ \"$TRANSPORT_MODE\" = \"stdio\" ]; then node dist/index.js; else node dist/sse-server.js; fi"]