# ============================================
# Stage 1: Builder (using official Puppeteer image)
# ============================================
FROM ghcr.io/puppeteer/puppeteer:24.33.0 AS builder

# Switch to root for installing dependencies
USER root

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including devDependencies for TypeScript)
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# ============================================
# Stage 2: Production (using official Puppeteer image)
# ============================================
FROM ghcr.io/puppeteer/puppeteer:24.33.0

# Switch to root for setup
USER root

WORKDIR /app

# Update system packages and install CA certificates
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install production dependencies only
ENV NODE_ENV=production
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create directories with proper permissions for pptruser (UID 10042)
RUN mkdir -p /app/output /app/logs /app/data && \
    chown -R pptruser:pptruser /app

# Create entrypoint script to fix permissions at runtime (for mounted volumes)
RUN echo '#!/bin/sh\n\
    # Fix permissions for mounted volumes (if running as root via --user)\n\
    if [ "$(id -u)" = "0" ]; then\n\
    chown -R pptruser:pptruser /app/output /app/logs /app/data 2>/dev/null || true\n\
    exec su-exec pptruser "$@"\n\
    fi\n\
    exec "$@"' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Puppeteer's bundled Chrome is already configured in the base image
# No need to set PUPPETEER_EXECUTABLE_PATH

# Switch to non-root user (pptruser from base image)
USER pptruser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application (both API server and Telegram bot)
CMD ["node", "dist/start.js"]
