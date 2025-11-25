import { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '../types/errors';

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string;
    const validApiKey = process.env.API_KEY;

    if (!validApiKey) {
        console.error('[Auth] API_KEY not configured in environment variables');
        res.status(500).json({ error: 'Server configuration error' });
        return;
    }

    if (!apiKey || apiKey !== validApiKey) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    next();
};
