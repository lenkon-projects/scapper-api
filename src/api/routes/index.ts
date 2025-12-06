import { Router } from 'express';
import parseRoutes from './parse.routes';
import eventsRoutes from './events.routes';
import eventimRoutes from './eventim.routes';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication to all API routes
router.use('/parse', authMiddleware, parseRoutes);
router.use('/events', authMiddleware, eventsRoutes);
router.use('/eventim', authMiddleware, eventimRoutes);

export default router;
