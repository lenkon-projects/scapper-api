import swaggerJsdoc from 'swagger-jsdoc';

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
                url: process.env.API_HOST ? `http://${process.env.API_HOST}:${process.env.API_PORT || 3000}` : 'http://localhost:3000',
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-API-Key',
                    description: 'API key for authentication. Can also be passed as query parameter ?apiKey=',
                },
            },
        },
        security: [
            {
                ApiKeyAuth: [],
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
    apis: ['./src/api/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
