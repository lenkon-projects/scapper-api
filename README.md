# WordPress Events Management Platform

A comprehensive event management platform that automates WordPress event ticket scraping, provides REST API access, Telegram bot notifications, and Monday.com project management integration with Docker deployment.

## Architecture Overview

This is a multi-service platform with the following components:

- **🌐 REST API Server** - Express.js API with job queue system and Swagger documentation
- **🤖 Telegram Bot** - Automated notifications and command interface with user authentication
- **📊 Monday.com Integration** - Automatic project board synchronization with ticket data
- **🔍 WordPress Scraper** - Puppeteer-based parser with bot protection bypass
- **🐳 Docker Deployment** - Production-ready containerized deployment with nginx

## Quick Start

### Development Mode

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start all services (API + Bot)
npm run start:all:dev

# Or start individually
npm run api:dev    # API server only
npm run bot:dev    # Telegram bot only
```

### Production Mode

```bash
# Docker deployment
docker-compose up -d

# Or build and run
npm run build
npm run start:all:prod
```

## Services & Ports

- **API Server**: `http://localhost:3000`
- **API Documentation**: `http://localhost:3000/api-docs`
- **Health Check**: `http://localhost:3000/api/health`
- **Telegram Bot**: Runs alongside API server

## Requirements

- **Node.js** (v18+)
- **Docker & Docker Compose** (for production)
- **TypeScript** (for development)
- **WordPress Admin Access** (for parsing)
- **Monday.com API Access** (for sync)
- **Telegram Bot Token** (for notifications)

## Key Features

### REST API

- Asynchronous job queue for parsing operations
- JWT-less API key authentication
- Rate limiting and security middleware
- Comprehensive error handling and logging
- OpenAPI/Swagger documentation
- Health monitoring endpoints

### Telegram Bot

- User whitelist authentication system
- Real-time parsing and sync notifications
- Interactive command interface
- Chat ID tracking and management
- Error reporting and status updates

### WordPress Scraper

- Bot protection bypass (uPress/Cloudflare)
- Stealth browser automation with Puppeteer
- Hebrew text parsing with regex patterns
- Screenshot verification
- Timestamped JSON output

### Monday.com Integration

- Automatic board item synchronization
- Event ID mapping with "OZ-" prefix
- Capacity and ticket sales tracking
- Update timestamp logging
- Comprehensive error handling

### DevOps & Production

- Multi-stage Docker builds
- nginx reverse proxy with SSL
- GitHub Actions CI/CD pipeline
- UFW firewall and fail2ban security
- Winston logging with rotation

## Core Scripts

```bash
# Parse and sync in one operation
npm run parse:sync:dev
npm run parse:sync:prod

# Monday.com sync only
npm run sync:monday:dev
npm run sync:monday:prod

# Test Monday.com integration
npm run test:monday

# Build for production
npm run build
```

## Configuration

The platform requires extensive environment configuration. Create a `.env` file with 50+ variables:

```bash
# API Configuration
API_KEY=your-uuid-v4-api-key
API_PORT=3000
API_HOST=0.0.0.0
API_BASE_URL=https://your-domain.com

# WordPress Credentials
WP_LOGIN_URL=https://site.com/wp-login.php
WP_USERNAME=your_username
WP_PASSWORD=your_password
TARGET_URL=https://site.com/wp-admin/

# Monday.com Integration
MONDAY_COM_API_KEY=your_monday_api_key
MONDAY_COM_BOARD_ID=your_board_id
MONDAY_COM_EVENT_ID_COLUMN=text_column_id
MONDAY_COM_CAPACITY_COLUMN=numeric_column_id
MONDAY_COM_TICKETS_SOLD_COLUMN=numeric_column_id
MONDAY_COM_UPDATE_DATE_COLUMN=date_column_id

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321

# Browser Settings
HEADLESS=true
TIMEOUT=30000
CLOSE_BROWSER=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10
```

## Data Flow

1. **WordPress Parsing** → Extract event data (ID, tickets sold, capacity, status)
2. **JSON Storage** → Save timestamped files to `./output/events_[timestamp].json`
3. **Monday.com Sync** → Update project board with latest ticket data
4. **Telegram Notifications** → Send real-time updates to authorized users
5. **API Access** → Provide REST endpoints for external integrations

## Project Structure

```
src/
├── api/                     # REST API server
│   ├── server.ts           # Express application
│   ├── routes/             # API endpoints
│   ├── controllers/        # Request handlers
│   ├── services/           # Business logic
│   ├── middleware/         # Auth, logging, error handling
│   └── config/             # Swagger configuration
├── bot/                     # Telegram bot
│   ├── telegram-bot.ts     # Bot service
│   └── services/           # Auth, notifications, chat tracking
├── core/                    # WordPress scraper
│   ├── scraper.ts          # Main parsing logic
│   ├── types.ts            # TypeScript interfaces
│   └── utils.ts            # Helper functions
├── scripts/                 # Standalone utilities
│   ├── parse_and_sync.ts   # Combined parse + Monday sync
│   ├── sync_monday.ts      # Monday.com sync only
│   └── test_monday_items.ts # Monday.com testing
└── start.ts                # Multi-service startup
```

## Documentation

Detailed documentation is available in separate files:

- **[API.md](API.md)** - Complete REST API documentation with examples
- **[BOT.md](BOT.md)** - Telegram bot setup, commands, and usage
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Docker deployment and production setup

## Security Features

- API key authentication for all endpoints
- Rate limiting to prevent abuse
- CORS protection with configurable origins
- Security headers via Helmet.js
- User whitelist for Telegram bot access
- Environment variable isolation
- Container security with non-root user

## Monitoring & Logging

- Health check endpoints for uptime monitoring
- Winston structured logging with rotation
- Request/response logging with correlation IDs
- Error tracking with stack traces
- Performance metrics and timing
- Docker container health checks

## License

ISC
