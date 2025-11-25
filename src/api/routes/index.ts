import { Router } from 'express';
import parseRoutes from './parse.routes';
import eventsRoutes from './events.routes';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication to all API routes
router.use('/parse', authMiddleware, parseRoutes);
router.use('/events', authMiddleware, eventsRoutes);

export default router;
