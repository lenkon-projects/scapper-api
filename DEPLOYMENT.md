# Deployment Documentation

This guide covers Docker deployment, production setup, and infrastructure configuration for the WordPress Events Management Platform.

## Overview

The platform is designed for production deployment using:

- **Docker** - Containerized application with multi-stage builds
- **Docker Compose** - Multi-service orchestration
- **nginx** - Reverse proxy with SSL termination
- **GitHub Actions** - Automated CI/CD pipeline
- **Ubuntu Server** - Recommended production environment

## Quick Deployment

### Prerequisites

- Ubuntu 20.04+ server with root access
- Domain name pointing to your server
- GitHub repository access
- Docker and Docker Compose installed

### One-Command Setup

```bash
# Clone repository
git clone https://github.com/lenkon-projects/scapper-api.git
cd scapper-api

# Run server setup script
sudo bash scripts/server-setup.sh

# Configure SSL
sudo bash scripts/ssl-setup.sh

# Configure environment and deploy
cp .env.example .env
# Edit .env with your configuration
docker-compose up -d
```

## Docker Configuration

### Dockerfile

The application uses a multi-stage Docker build for optimization:

```dockerfile
# Stage 1: Builder
FROM ghcr.io/puppeteer/puppeteer:latest AS builder
# Install dependencies and build TypeScript

# Stage 2: Production
FROM ghcr.io/puppeteer/puppeteer:latest
# Copy built app and run production
```

**Features:**

- Based on official Puppeteer image for browser automation
- Non-root user (`pptruser`) for security
- TypeScript compilation in builder stage
- Production-only dependencies in final image
- Health check endpoint monitoring

### Docker Compose

#### Production Configuration (`docker-compose.yml`)

```yaml
services:
  api:
    image: ghcr.io/${GITHUB_REPOSITORY}:latest
    container_name: wordpress-parser-api
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000" # Localhost only (nginx proxy)
    environment:
      NODE_ENV: production
      API_PORT: 3000
      API_HOST: 0.0.0.0
      # ... all environment variables from .env
    volumes:
      - ./output:/app/output
      - ./logs:/app/logs
      - ./data:/app/data
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })",
        ]
      interval: 30s
      timeout: 10s
      start_period: 40s
      retries: 3
```

#### Development Override (`docker-compose.override.yml`)

```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    volumes:
      - ./src:/app/src:ro
      - ./output:/app/output
      - ./logs:/app/logs
    environment:
      NODE_ENV: development
    ports:
      - "3000:3000" # Direct access for development
```

### Environment Configuration

#### Required Variables

```bash
# API Configuration
API_KEY=550e8400-e29b-41d4-a716-446655440000  # UUID v4
API_PORT=3000
API_HOST=0.0.0.0
API_BASE_URL=https://scrapper.liorizhakidrums.com

# WordPress Credentials
WP_LOGIN_URL=https://ozentelaviv.com/wp-login.php
WP_USERNAME=your_admin_email@example.com
WP_PASSWORD=your_secure_password
TARGET_URL=https://ozentelaviv.com/wp-admin/

# Monday.com Integration
MONDAY_COM_API_KEY=your_monday_api_key_here
MONDAY_COM_BOARD_ID=5086703491
MONDAY_COM_EVENT_ID_COLUMN=text_mkxy6ra8
MONDAY_COM_CAPACITY_COLUMN=numeric_mkxst6mx
MONDAY_COM_TICKETS_SOLD_COLUMN=numeric_mkxsf3c8
MONDAY_COM_UPDATE_DATE_COLUMN=date_mky2adca

# Telegram Bot
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321
```

## Server Setup

### Automated Setup Script

File: `scripts/server-setup.sh`

```bash
#!/bin/bash
set -e

echo "WordPress Parser API - Server Setup"

# Update system
apt-get update && apt-get upgrade -y

# Install essential packages
apt-get install -y curl wget git ufw fail2ban ca-certificates gnupg

# Install Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Install nginx
apt-get install -y nginx

# Install Certbot
apt-get install -y certbot python3-certbot-nginx

# Configure firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# Configure fail2ban
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
systemctl enable fail2ban
systemctl start fail2ban

# Start services
systemctl enable docker nginx
systemctl start docker nginx

# Add user to docker group (if not root)
if [ "$SUDO_USER" ]; then
    usermod -aG docker $SUDO_USER
fi

echo "Server setup completed successfully!"
```

## GitHub Actions CI/CD

### Workflow Configuration

File: `.github/workflows/deploy.yml`

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha
            latest

      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /app/wordpress-parser
            docker-compose pull
            docker-compose up -d
            docker system prune -f
```

### Required GitHub Secrets

```bash
# Server connection
HOST=your.server.ip
USERNAME=deploy-user
SSH_KEY=your-private-ssh-key

# Optional: Registry credentials (if using private registry)
REGISTRY_USERNAME=your-username
REGISTRY_PASSWORD=your-password
```

## Production Deployment

### Step-by-Step Deployment

#### 1. Server Preparation

```bash
# Clone repository
git clone https://github.com/lenkon-projects/scapper-api.git
cd scapper-api

# Run setup script
sudo bash scripts/server-setup.sh
```

#### 2. Domain Configuration

```bash
# Copy nginx configuration
sudo cp nginx/scrapper.liorizhakidrums.com.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/scrapper.liorizhakidrums.com.conf /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

#### 3. SSL Certificate

```bash
# Run SSL setup script
sudo bash scripts/ssl-setup.sh

# Or manual setup
sudo certbot --nginx -d your-domain.com
```

#### 4. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
# Add all required variables
```

#### 5. Deploy Application

```bash
# Pull and start containers
docker-compose pull
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

### Health Checks

```bash
# Check container health
docker-compose ps

# Check application health
curl https://your-domain.com/api/health

# Check logs
docker-compose logs api

# Check nginx status
sudo systemctl status nginx

# Check SSL certificate
curl -I https://your-domain.com
```

## Monitoring & Maintenance

### Log Management

#### Application Logs

```bash
# View live logs
docker-compose logs -f api

# View specific timeframe
docker-compose logs --since="2023-11-27T10:00:00" api

# Save logs to file
docker-compose logs api > app.log
```

#### nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/scrapper_access.log

# Error logs
sudo tail -f /var/log/nginx/scrapper_error.log

# Log rotation
sudo logrotate /etc/logrotate.d/nginx
```

### System Monitoring

#### Resource Usage

```bash
# Docker container stats
docker stats

# System resource usage
htop
df -h
free -h
```

#### Health Monitoring

```bash
# Application health check
curl -f https://your-domain.com/api/health || echo "Health check failed"

# Service status
sudo systemctl status nginx docker

# Container health
docker-compose ps
```

## Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check logs
docker-compose logs api

# Check environment variables
docker-compose config

# Restart services
docker-compose down
docker-compose up -d
```

#### SSL Issues

```bash
# Test SSL certificate
openssl s_client -connect your-domain.com:443

# Renew certificate
sudo certbot renew --force-renewal

# Check nginx SSL configuration
sudo nginx -t
```

#### Application Errors

```bash
# Check application health
curl https://your-domain.com/api/health

# View application logs
docker-compose logs -f api

# Check WordPress connectivity
docker-compose exec api wget -q --spider https://wordpress-site.com
```

### Security Updates

#### Regular Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose pull
docker-compose up -d

# Update SSL certificates
sudo certbot renew

# Update application
git pull origin main
docker-compose up -d --build
```

This deployment documentation provides comprehensive coverage for production deployment, monitoring, and maintenance of the WordPress Events Management Platform.
