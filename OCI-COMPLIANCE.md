# OCI Compliance Guide

This document outlines how the Azure Logs MCP project adheres to the Open Container Initiative (OCI) specifications and supports multiple container runtimes.

## Table of Contents

- [OCI Standards Compliance](#oci-standards-compliance)
  - [Image Specification](#image-specification)
  - [Runtime Specification](#runtime-specification)
  - [Distribution Specification](#distribution-specification)
- [Supported Container Runtimes](#supported-container-runtimes)
  - [Primary Support](#primary-support)
  - [Additional OCI Runtimes](#additional-oci-runtimes)
- [File Structure](#file-structure)
- [OCI Labels](#oci-labels)
- [Runtime Verification](#runtime-verification)
  - [Verify OCI Compliance](#verify-oci-compliance)
  - [Registry Compatibility](#registry-compatibility)
- [Security Features](#security-features)
  - [Rootless Execution](#rootless-execution)
  - [Minimal Attack Surface](#minimal-attack-surface)
  - [Resource Constraints](#resource-constraints)
- [Migration from Docker](#migration-from-docker)
  - [For Existing Docker Users](#for-existing-docker-users)
  - [Advantages of Podman](#advantages-of-podman)
- [Best Practices](#best-practices)
  - [Build Optimization](#build-optimization)
  - [Security](#security)
  - [Portability](#portability)
- [Troubleshooting](#troubleshooting)
  - [Common Issues](#common-issues)
- [Validation Checklist](#validation-checklist)
- [References](#references)

## OCI Standards Compliance

### Image Specification

- ✅ **OCI Image Format**: All container images follow the OCI Image Format Specification v1.0.0
- ✅ **OCI Labels**: Proper metadata labels using `org.opencontainers.image.*` namespace
- ✅ **Multi-architecture**: Support for multiple CPU architectures (amd64, arm64)
- ✅ **Layer Optimization**: Efficient layer structure for optimal caching and distribution

### Runtime Specification

- ✅ **OCI Runtime**: Compatible with any OCI-compliant runtime (runc, crun, kata, etc.)
- ✅ **Container Configuration**: Follows OCI Runtime Specification v1.0.0
- ✅ **Security**: Non-root user execution, minimal privileges
- ✅ **Resource Limits**: Proper resource constraint definitions

### Distribution Specification

- ✅ **Registry Compatibility**: Works with any OCI-compliant registry
- ✅ **Content Addressing**: Proper content-addressable storage
- ✅ **Manifest Format**: OCI-compliant manifest structure

## Supported Container Runtimes

### Primary Support

- **Podman** (Recommended) - Daemonless, rootless, OCI-native
- **Docker** - Traditional container runtime with OCI support

### Additional OCI Runtimes

- **Buildah** - Container image building
- **Skopeo** - Container image operations
- **CRI-O** - Kubernetes container runtime
- **containerd** - Industry-standard container runtime

## File Structure

```
├── Containerfile          # Universal OCI-compliant build file (works with Docker and Podman)
├── .containerignore       # OCI-generic ignore file
└── OCI-COMPLIANCE.md      # This file
```

## OCI Labels

All container images include standardized OCI labels:

```dockerfile
LABEL org.opencontainers.image.title="Azure Logs MCP Server"
LABEL org.opencontainers.image.description="Model Context Protocol server for Azure Application Insights logs"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.authors="Azure Logs MCP Team"
LABEL org.opencontainers.image.source="https://github.com/your-org/azure-logs-mcp"
LABEL org.opencontainers.image.licenses="ISC"
```

## Runtime Verification

### Verify OCI Compliance

```bash
# Check image labels
podman inspect azure-logs-mcp | jq '.[0].Config.Labels'

# Verify OCI format
skopeo inspect containers-storage:azure-logs-mcp

# Test with different runtimes
podman run --rm azure-logs-mcp --version
docker run --rm azure-logs-mcp --version
```

### Registry Compatibility

```bash
# Push to different OCI registries
podman push azure-logs-mcp docker.io/username/azure-logs-mcp
podman push azure-logs-mcp quay.io/username/azure-logs-mcp
podman push azure-logs-mcp ghcr.io/username/azure-logs-mcp
```

## Security Features

### Rootless Execution

- Container runs as non-root user (UID 1001)
- Podman supports rootless containers by default
- No privileged access required

### Minimal Attack Surface

- Alpine Linux base image
- Multi-stage builds to reduce image size
- Only production dependencies in final image

### Resource Constraints

```yaml
# Example resource limits in compose
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 512M
    reservations:
      cpus: '0.25'
      memory: 256M
```

## Migration from Docker

### For Existing Docker Users

1. **Install Podman**:

   ```bash
   # Ubuntu/Debian
   sudo apt-get install podman

   # RHEL/CentOS/Fedora
   sudo dnf install podman

   # macOS
   brew install podman
   ```

2. **Use Container Commands**:

   ```bash
   # Both Docker and Podman use the same Containerfile
   docker build -f Containerfile -t azure-logs-mcp .
   podman build -f Containerfile -t azure-logs-mcp .

   # Same run commands
   docker run --env-file .env -p 3000:3000 azure-logs-mcp
   podman run --env-file .env -p 3000:3000 azure-logs-mcp
   ```

3. **Unified Build File**:
   ```bash
   # Single Containerfile works with both runtimes
   # No need for separate Dockerfile and Containerfile
   ```

### Advantages of Podman

- **Daemonless**: No background daemon required
- **Rootless**: Enhanced security with user namespaces
- **Pod Support**: Native Kubernetes pod concepts
- **Systemd Integration**: Native systemd service generation
- **OCI Native**: Built from ground up for OCI compliance

## Best Practices

### Build Optimization

- Use multi-stage builds
- Leverage build cache effectively
- Minimize layer count
- Use `.containerignore` to exclude unnecessary files

### Security

- Always run as non-root user
- Use specific base image tags (not `latest`)
- Regularly update base images
- Scan images for vulnerabilities

### Portability

- Use OCI-compliant features only
- Test with multiple runtimes
- Use standard port mappings
- Avoid runtime-specific features

## Troubleshooting

### Common Issues

1. **Permission Denied (Rootless)**:

   ```bash
   # Check user namespaces
   podman info --debug

   # Fix subuid/subgid
   sudo usermod --add-subuids 100000-165535 $USER
   sudo usermod --add-subgids 100000-165535 $USER
   ```

2. **Port Binding Issues**:

   ```bash
   # Use unprivileged ports (>1024) for rootless
   podman run -p 3000:3000 azure-logs-mcp  # Good
   podman run -p 80:3000 azure-logs-mcp    # Requires root
   ```

3. **Registry Authentication**:
   ```bash
   # Login to registry
   podman login docker.io
   podman login quay.io
   ```

## Validation Checklist

- [ ] Image builds with both Docker and Podman
- [ ] Container runs rootless
- [ ] All OCI labels present
- [ ] Health checks work
- [ ] Multi-architecture support
- [ ] Registry push/pull works
- [ ] Compose files work with both runtimes
- [ ] Security scan passes
- [ ] Resource limits respected
- [ ] Systemd integration works (Podman)

## References

- [OCI Image Specification](https://github.com/opencontainers/image-spec)
- [OCI Runtime Specification](https://github.com/opencontainers/runtime-spec)
- [OCI Distribution Specification](https://github.com/opencontainers/distribution-spec)
- [Podman Documentation](https://docs.podman.io/)
- [Container Best Practices](https://developers.redhat.com/blog/2018/02/22/container-terminology-practical-introduction)
