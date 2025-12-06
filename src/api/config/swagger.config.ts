import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

// Determine if we're in development or production
const isDevelopment = process.env.NODE_ENV !== 'production';

// In production, we're running from dist/api/server.js
// In development, we're running from src/api/server.ts
const apiRoutesPath = isDevelopment
    ? './src/api/routes/*.ts'
    : path.join(__dirname, '../routes/*.js');

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'WordPress Events Parser API',
            version: '1.0.0',
            description: 'REST API for WordPress event ticket scraping with async job management',
            contact: {
                name: 'API Support',
            },
        },
        servers: [
            {
                url: process.env.API_BASE_URL || (process.env.API_HOST ? `http://${process.env.API_HOST}:${process.env.API_PORT || 3000}` : 'http://localhost:3000'),
                description: isDevelopment ? 'Development server' : 'Production server',
            },
        ],
        components: {
            securitySchemes: {
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-API-Key',
                    description: 'Global API key for administrative access. Can also be passed as query parameter ?apiKey=',
                },
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'tk_xxx',
                    description: 'User token obtained from Telegram bot /myid command. Format: Authorization: Bearer tk_xxx',
                },
                UserTokenAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-User-Token',
                    description: 'Alternative header for user token. Format: X-User-Token: tk_xxx',
                },
            },
        },
        security: [
            {
                ApiKeyAuth: [],
            },
            {
                BearerAuth: [],
            },
            {
                UserTokenAuth: [],
            },
        ],
        tags: [
            {
                name: 'Parse',
                description: 'Parse job management endpoints',
            },
            {
                name: 'Events',
                description: 'Events data retrieval endpoints',
            },
        ],
    },
    apis: [apiRoutesPath],
};

export const swaggerSpec = swaggerJsdoc(options);
