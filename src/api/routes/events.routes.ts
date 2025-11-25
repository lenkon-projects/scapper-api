import { Router } from 'express';
import * as eventsController from '../controllers/events.controller';

const router = Router();

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Get events data
 *     description: Retrieves events from the latest parse or a specific file
 *     tags: [Events]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: file
 *         schema:
 *           type: string
 *         description: Optional specific file name (e.g., events_1764067369234.json)
 *     responses:
 *       200:
 *         description: Events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 source:
 *                   type: string
 *                 parsedAt:
 *                   type: string
 *                   format: date-time
 *                 eventCount:
 *                   type: integer
 *                 events:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       active:
 *                         type: boolean
 *                       eventId:
 *                         type: string
 *                       ticketsSold:
 *                         type: object
 *                         properties:
 *                           total:
 *                             type: integer
 *                           capacity:
 *                             type: integer
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No events found
 */
router.get('/', eventsController.getEvents);

/**
 * @swagger
 * /api/events/files:
 *   get:
 *     summary: List all event files
 *     description: Returns a list of all available event data files
 *     tags: [Events]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Files listed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 files:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       filename:
 *                         type: string
 *                       timestamp:
 *                         type: integer
 *                       parsedAt:
 *                         type: string
 *                         format: date-time
 *                       size:
 *                         type: integer
 *                 totalFiles:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */
router.get('/files', eventsController.listFiles);

export default router;
