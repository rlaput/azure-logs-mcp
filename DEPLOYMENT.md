# Azure Logs MCP - Deployment Guide

This guide covers containerization and deployment strategies for the Azure Logs MCP server.

## Container Support

The Azure Logs MCP server supports two transport modes:

1. **stdio** - Standard MCP protocol for direct client connections
2. **SSE (Server-Sent Events)** - Web-based transport for browser clients and remote connections

## Quick Start with Docker

### 1. Build the Container

```bash
# Build the Docker image
npm run docker:build

# Or manually
docker build -t azure-logs-mcp .
```

### 2. Run with Docker

```bash
# Run SSE mode (default)
npm run docker:run

# Or manually with environment file
docker run --env-file .env -p 3000:3000 azure-logs-mcp

# Run stdio mode
docker run --env-file .env -e TRANSPORT_MODE=stdio azure-logs-mcp
```

### 3. Run with Docker Compose

```bash
# Start all services
npm run docker:compose

# Or manually
docker-compose up --build

# Run with development profile (includes MCP Inspector)
docker-compose --profile dev up --build
```

## Environment Configuration

### Required Variables

```bash
AZURE_CLIENT_ID=your_client_id_here
AZURE_TENANT_ID=your_tenant_id_here
AZURE_CLIENT_SECRET=your_client_secret_here
AZURE_MONITOR_WORKSPACE_ID=your_workspace_id_here
```

### Container-Specific Variables

```bash
# Server Configuration
PORT=3000                    # Port for SSE server (default: 3000)
TRANSPORT_MODE=sse          # Transport mode: 'sse' or 'stdio' (default: sse)
NODE_ENV=production         # Environment mode
LOG_LEVEL=2                 # Log level (0=ERROR, 1=WARN, 2=INFO, 3=DEBUG)

# CORS Configuration (SSE mode only)
CORS_ORIGIN=*               # Allowed origins for CORS (default: *)
```

## Transport Modes

### SSE (Server-Sent Events) Mode

**Best for:**
- Web applications
- Remote client connections
- Browser-based MCP clients
- Cloud deployments

**Features:**
- HTTP/HTTPS endpoint
- CORS support for web clients
- Health check endpoint
- RESTful architecture

**Endpoints:**
- `GET /sse` - MCP SSE endpoint
- `GET /health` - Health check endpoint

**Usage:**
```bash
# Development
npm run dev:sse

# Production
npm run start:sse

# Docker
docker run -e TRANSPORT_MODE=sse -p 3000:3000 azure-logs-mcp
```

### stdio Mode

**Best for:**
- Direct client connections
- Local development
- Command-line tools
- Traditional MCP clients

**Features:**
- Standard input/output communication
- Lower overhead
- Direct process communication

**Usage:**
```bash
# Development
npm run dev

# Production
npm run start

# Docker
docker run -e TRANSPORT_MODE=stdio azure-logs-mcp
```

## Cloud Deployment

### Azure Container Apps

Based on the MCP documentation patterns, here's how to deploy to Azure Container Apps:

1. **Register Azure Resource Provider:**
```bash
az provider register --namespace Microsoft.App --wait
```

2. **Deploy to Azure Container Apps:**
```bash
az containerapp up \
  -g <RESOURCE_GROUP_NAME> \
  -n azure-logs-mcp \
  --environment mcp \
  -l westus \
  --env-vars AZURE_CLIENT_ID=<CLIENT_ID> AZURE_TENANT_ID=<TENANT_ID> AZURE_CLIENT_SECRET=<CLIENT_SECRET> AZURE_MONITOR_WORKSPACE_ID=<WORKSPACE_ID> \
  --source . \
  --ingress external \
  --target-port 3000
```

3. **Using Azure Developer CLI (azd):**
```bash
# Initialize azd project
azd init

# Deploy to Azure
azd up
```

### Docker Hub Deployment

1. **Build and tag:**
```bash
docker build -t <your-username>/azure-logs-mcp .
```

2. **Push to Docker Hub:**
```bash
docker push <your-username>/azure-logs-mcp
```

3. **Deploy from Docker Hub:**
```bash
docker run --env-file .env -p 3000:3000 <your-username>/azure-logs-mcp
```

## Health Monitoring

### Health Check Endpoint (SSE Mode)

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Docker Health Checks

The container includes built-in health checks:

```bash
# Check container health
docker ps

# View health check logs
docker inspect <container-id>
```

## Security Considerations

### Container Security

- **Non-root user**: Container runs as user `mcp` (UID 1001)
- **Minimal base image**: Uses Alpine Linux for smaller attack surface
- **Multi-stage build**: Separates build and runtime environments
- **Environment isolation**: Sensitive data via environment variables

### Network Security

- **CORS configuration**: Configurable origin restrictions
- **Rate limiting**: Built-in protection against abuse
- **Input validation**: Comprehensive input sanitization
- **Error sanitization**: Prevents information disclosure

## Troubleshooting

### Common Issues

1. **Health check failures:**
   - Verify Azure credentials
   - Check network connectivity
   - Validate workspace ID

2. **SSE connection issues:**
   - Verify CORS configuration
   - Check firewall settings
   - Ensure port 3000 is accessible

3. **Container startup failures:**
   - Check environment variables
   - Verify Docker build process
   - Review container logs

### Debugging Commands

```bash
# View container logs
docker logs <container-id>

# Execute shell in container
docker exec -it <container-id> sh

# Check environment variables
docker exec <container-id> env

# Test health endpoint
curl -f http://localhost:3000/health || echo "Health check failed"
```

## Performance Optimization

### Container Optimization

- **Multi-stage builds**: Reduces final image size
- **Layer caching**: Optimizes build times
- **Production dependencies**: Only installs runtime dependencies

### Runtime Optimization

- **Rate limiting**: Prevents resource exhaustion
- **Query timeouts**: Prevents hanging requests
- **Memory management**: Efficient logging and cleanup

## Monitoring and Logging

### Structured Logging

All logs are output in JSON format for easy parsing:

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "INFO",
  "logger": "azure-logs-mcp",
  "message": "Server started successfully"
}
```

### Log Levels

- `LOG_LEVEL=0` (ERROR): Only critical errors
- `LOG_LEVEL=1` (WARN): Warnings and errors
- `LOG_LEVEL=2` (INFO): General information (default)
- `LOG_LEVEL=3` (DEBUG): Detailed debugging information

### Container Logs

```bash
# Follow logs in real-time
docker logs -f <container-id>

# View recent logs
docker logs --tail 100 <container-id>

# Export logs
docker logs <container-id> > mcp-server.log
```

## Integration Examples

### MCP Inspector (Development)

```bash
# Start server in SSE mode
docker-compose --profile dev up

# Access MCP Inspector at http://localhost:5173
# Connect to: http://localhost:3000/sse
```

### GitHub Copilot Integration

Add to your `mcp.json` configuration:

```json
{
  "servers": {
    "azure-logs": {
      "type": "sse",
      "url": "http://localhost:3000/sse"
    }
  }
}
```

### Custom Client Integration

```javascript
// Example SSE client connection
const eventSource = new EventSource('http://localhost:3000/sse');

eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('MCP message:', data);
};
```

## Next Steps

1. **Set up CI/CD pipeline** using Azure DevOps or GitHub Actions
2. **Configure monitoring** with Azure Application Insights
3. **Implement scaling** with Azure Container Apps scaling rules
4. **Add authentication** for production deployments
5. **Set up backup strategies** for configuration and logs