# ============================================
# Stage 1: Builder (using official Puppeteer image)
# ============================================
FROM ghcr.io/puppeteer/puppeteer:latest AS builder

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
FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root for setup
USER root

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
ENV NODE_ENV=production
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create directories with proper permissions for pptruser (UID 10042)
RUN mkdir -p /app/output /app/logs && \
    chown -R pptruser:pptruser /app

# Puppeteer's bundled Chrome is already configured in the base image
# No need to set PUPPETEER_EXECUTABLE_PATH

# Switch to non-root user (pptruser from base image)
USER pptruser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["node", "dist/api/server.js"]
