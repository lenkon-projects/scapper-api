import 'dotenv/config';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.config';
import { requestLogger, logger } from './middleware/logger.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import routes from './routes';

const app: Application = express();
const port = process.env.API_PORT || 3000;
const host = process.env.API_HOST || '0.0.0.0';

// 1. Security & basics
app.use(helmet({
    contentSecurityPolicy: false,  // Disable for Swagger UI
    crossOriginEmbedderPolicy: false,
}));

app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization', 'X-User-Token'],
}));

app.use(compression());

// 2. Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Request logging
app.use(requestLogger);

// 4. Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10'),
    message: { error: 'Too many requests from this IP, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', limiter);

// 5. Health check (no auth required)
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// 6. Swagger documentation (no auth required)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'WordPress Parser API Docs',
}));

// 7. API routes (with auth)
app.use('/api', routes);

// 8. Error handling (must be last)
app.use(errorMiddleware);

// Start server
const server = app.listen(port, () => {
    logger.info(`🚀 API Server running on http://${host}:${port}`);
    logger.info(`📚 API Documentation available at http://${host}:${port}/api-docs`);
    logger.info(`🏥 Health check available at http://${host}:${port}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

export default app;
