# Svelte Treeview v4 Showcase - Deployment Guide

This guide explains how to deploy the Svelte Treeview v4 showcase website using Docker.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local development)

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Build and run the showcase
docker-compose up --build -d

# Visit http://localhost:8080
```

### Option 2: Manual Docker Build

```bash
# Build the Docker image
docker build -t svelte-treeview-showcase .

# Run the container
docker run -d -p 8080:80 --name treeview-showcase svelte-treeview-showcase

# Visit http://localhost:8080
```

## Development

### Local Development Server

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Visit http://localhost:17777
```

### Building for Production

```bash
# Install static adapter (if not already installed)
npm install --save-dev @sveltejs/adapter-static

# Build the static site
npm run build:showcase

# The built files will be in the 'build' directory
```

## Deployment Options

### 1. Static Hosting (Netlify, Vercel, GitHub Pages)

The `build` directory contains static files that can be deployed to any static hosting service.

```bash
npm run build:showcase
# Deploy contents of 'build' directory
```

### 2. Docker Container (Production)

The Dockerfile creates a lightweight nginx-based container:

- **Base Image**: nginx:alpine (~15MB)
- **Build Process**: Multi-stage build with Node.js 18
- **Features**: Gzip compression, security headers, SPA routing

### 3. Cloud Platforms

#### AWS (with ECR + ECS/Fargate)

```bash
# Build and tag for AWS ECR
docker build -t your-account.dkr.ecr.region.amazonaws.com/svelte-treeview:latest .

# Push to ECR
aws ecr get-login-password --region region | docker login --username AWS --password-stdin your-account.dkr.ecr.region.amazonaws.com
docker push your-account.dkr.ecr.region.amazonaws.com/svelte-treeview:latest
```

#### Google Cloud Run

```bash
# Build and deploy to Cloud Run
gcloud builds submit --tag gcr.io/your-project/svelte-treeview
gcloud run deploy --image gcr.io/your-project/svelte-treeview --platform managed
```

#### Azure Container Instances

```bash
# Build and push to Azure Container Registry
az acr build --registry myregistry --image svelte-treeview .
az container create --resource-group myResourceGroup --name svelte-treeview --image myregistry.azurecr.io/svelte-treeview:latest
```

## Configuration

### Environment Variables

The container supports these optional environment variables:

- `NODE_ENV`: Set to `production` for production builds
- `PORT`: Internal port (defaults to 80)

### Custom Nginx Configuration

To customize nginx settings, mount a custom configuration:

```bash
docker run -d -p 8080:80 \
  -v ./custom-nginx.conf:/etc/nginx/conf.d/default.conf \
  svelte-treeview-showcase
```

## Performance

The built container includes:

- **Gzip compression** for all text assets
- **Cache headers** for static assets (1 year)
- **Security headers** (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- **SPA routing** support for client-side navigation

## Troubleshooting

### Build Issues

If you encounter build issues:

1. Ensure Node.js 18+ is available during build
2. Check that all dependencies are installed
3. Verify the static adapter is properly configured

### Runtime Issues

If the container doesn't start:

1. Check Docker logs: `docker logs svelte-treeview-showcase`
2. Verify port 80 is not already in use
3. Ensure build directory contains valid HTML files

### Development vs Production

The showcase uses different configurations:

- **Development**: Vite dev server on port 17777
- **Production**: Static build served by nginx on port 80

## Updates

To update the showcase:

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose up --build -d
```

## Security

The nginx configuration includes basic security headers. For production deployment, consider:

- HTTPS/TLS termination
- Content Security Policy headers
- Rate limiting
- Access logging and monitoring