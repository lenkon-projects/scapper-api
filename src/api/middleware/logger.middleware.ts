import winston from 'winston';
import expressWinston from 'express-winston';

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Add file transports if logs directory exists
import * as fs from 'fs';
const logsDir = './logs';
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error'
}));

logger.add(new winston.transports.File({
    filename: 'logs/combined.log'
}));

export const requestLogger = expressWinston.logger({
    winstonInstance: logger,
    meta: true,
    msg: 'HTTP {{req.method}} {{req.url}}',
    expressFormat: true,
    colorize: false,
    ignoreRoute: (req) => req.url === '/api/health' || req.url === '/api-docs'
});
