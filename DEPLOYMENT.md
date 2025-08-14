# Azure Logs MCP - Deployment Guide

This guide covers containerization and deployment strategies for the Azure Logs MCP server with full OCI (Open Container Initiative) compliance and support for both Docker and Podman.

## Table of Contents

- [Container Support](#container-support)
- [OCI Compliance](#oci-compliance)
- [Quick Start with Podman (Recommended)](#quick-start-with-podman-recommended)
  - [Build the Container](#1-build-the-container)
  - [Run with Podman](#2-run-with-podman)
- [Quick Start with Docker](#quick-start-with-docker)
  - [Build the Container](#1-build-the-container-1)
  - [Run with Docker](#2-run-with-docker-1)
- [Environment Configuration](#environment-configuration)
  - [Required Variables](#required-variables)
  - [Container-Specific Variables](#container-specific-variables)
- [Transport Modes](#transport-modes)
  - [SSE (Server-Sent Events) Mode](#sse-server-sent-events-mode)
  - [stdio Mode](#stdio-mode)
- [Container Runtime Comparison](#container-runtime-comparison)
- [Podman-Specific Features](#podman-specific-features)
  - [Rootless Containers](#rootless-containers)
  - [Pod Management](#pod-management)
  - [Systemd Integration](#systemd-integration)
  - [Container Registry Support](#container-registry-support)
- [Cloud Deployment](#cloud-deployment)
  - [Azure Container Apps](#azure-container-apps)
  - [Docker Hub Deployment](#docker-hub-deployment)
- [Health Monitoring](#health-monitoring)
  - [Health Check Endpoint (SSE Mode)](#health-check-endpoint-sse-mode)
  - [Docker Health Checks](#docker-health-checks)
- [Security Considerations](#security-considerations)
  - [Container Security](#container-security)
  - [Network Security](#network-security)
- [Troubleshooting](#troubleshooting)
  - [Common Issues](#common-issues)
  - [Debugging Commands](#debugging-commands)
- [Performance Optimization](#performance-optimization)
  - [Container Optimization](#container-optimization)
  - [Runtime Optimization](#runtime-optimization)
- [Monitoring and Logging](#monitoring-and-logging)
  - [Structured Logging](#structured-logging)
  - [Log Levels](#log-levels)
  - [Container Logs](#container-logs)
- [Integration Examples](#integration-examples)
  - [MCP Inspector (Development)](#mcp-inspector-development)
  - [GitHub Copilot Integration](#github-copilot-integration)
  - [Custom Client Integration](#custom-client-integration)
- [Next Steps](#next-steps)

## Container Support

The Azure Logs MCP server supports two transport modes:

1. **stdio** - Standard MCP protocol for direct client connections
2. **SSE (Server-Sent Events)** - Web-based transport for browser clients and remote connections

## OCI Compliance

This project is fully OCI-compliant and supports multiple container runtimes:

- **Docker** - Traditional container runtime
- **Podman** - Daemonless, rootless container engine
- **Any OCI-compatible runtime** - Buildah, CRI-O, containerd, etc.

## Quick Start with Podman (Recommended)

### 1. Build the Container

```bash
# Build with Podman using Containerfile
npm run container:build

# Or manually
podman build -f Containerfile -t azure-logs-mcp .
```

### 2. Run with Podman

```bash
# Run SSE mode (default)
npm run container:run

# Or manually with environment file
podman run --env-file .env -p 3000:3000 azure-logs-mcp

# Run stdio mode
podman run --env-file .env -e TRANSPORT_MODE=stdio azure-logs-mcp
```

### 3. Run with Podman

```bash
# Run in foreground
npm run podman:run

# Or run in background (detached)
podman run --env-file .env -p 3000:3000 -d --name azure-logs-mcp azure-logs-mcp

# Stop and remove container
podman stop azure-logs-mcp && podman rm azure-logs-mcp
```

## Quick Start with Docker

### 1. Build the Container

```bash
# Build the Docker image
npm run docker:build

# Or manually
docker build -f Containerfile -t azure-logs-mcp .
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

### 3. Run with Docker

```bash
# Run in foreground
npm run docker:run

# Or run in background (detached)
docker run --env-file .env -p 3000:3000 -d --name azure-logs-mcp azure-logs-mcp

# Stop and remove container
docker stop azure-logs-mcp && docker rm azure-logs-mcp
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

## Container Runtime Comparison

| Feature | Docker | Podman | Notes |
|---------|--------|--------|-------|
| Daemon | Required | Daemonless | Podman runs without a background daemon |
| Root Access | Required | Optional | Podman can run rootless containers |
| OCI Compliance | Yes | Yes | Both fully support OCI standards |
| Build Files | Containerfile | Containerfile | Both use the same OCI-standard Containerfile |
| Multi-container | docker-compose | podman pod | Different approaches for orchestration |

## Podman-Specific Features

### Rootless Containers

```bash
# Run as non-root user (Podman default)
podman run --env-file .env -p 3000:3000 azure-logs-mcp

# Explicitly run rootless
podman run --user 1001:1001 --env-file .env -p 3000:3000 azure-logs-mcp

# Check if running rootless
podman info --format "{{.Host.Security.Rootless}}"
```

### Pod Management

```bash
# Create a pod for related containers
podman pod create --name mcp-pod -p 3000:3000

# Run container in the pod
podman run --pod mcp-pod --env-file .env azure-logs-mcp

# List pods
podman pod ls

# Stop and remove pod
podman pod stop mcp-pod
podman pod rm mcp-pod
```

### Systemd Integration

```bash
# Generate systemd service files
podman generate systemd --new --files --name azure-logs-mcp

# Enable and start service (user mode)
systemctl --user enable container-azure-logs-mcp.service
systemctl --user start container-azure-logs-mcp.service

# Check service status
systemctl --user status container-azure-logs-mcp.service
```

### Container Registry Support

```bash
# Push to any OCI-compliant registry
podman build -f Containerfile -t quay.io/your-username/azure-logs-mcp .
podman push quay.io/your-username/azure-logs-mcp

# Pull and run from registry
podman run --env-file .env -p 3000:3000 quay.io/your-username/azure-logs-mcp
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

#### Docker Commands
```bash
# View container logs
docker logs <container-id>

# Execute shell in container
docker exec -it <container-id> sh

# Check environment variables
docker exec <container-id> env

# Check container health
docker ps
docker inspect <container-id>
```

#### Podman Commands
```bash
# View container logs
podman logs <container-id>

# Execute shell in container
podman exec -it <container-id> sh

# Check environment variables
podman exec <container-id> env

# Check container health
podman ps
podman inspect <container-id>

# Check rootless status
podman info --format "{{.Host.Security.Rootless}}"
```

#### Universal Commands
```bash
# Test health endpoint
curl -f http://localhost:3000/health || echo "Health check failed"

# Check port accessibility
netstat -tlnp | grep 3000
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
2. **Configure monitoring** with Azure Log Analytics Workspace
3. **Implement scaling** with Azure Container Apps scaling rules
4. **Add authentication** for production deployments
5. **Set up backup strategies** for configuration and logs