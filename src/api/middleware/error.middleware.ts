import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/errors';
import { logger } from './logger.middleware';

export const errorMiddleware = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            error: err.message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        });
        return;
    }

    // Unexpected errors
    logger.error('Unexpected error:', err);
    res.status(500).json({
        error: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && {
            message: err.message,
            stack: err.stack
        })
    });
};
