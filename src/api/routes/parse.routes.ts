import { Router } from 'express';
import * as parseController from '../controllers/parse.controller';

const router = Router();

/**
 * @swagger
 * /api/parse:
 *   post:
 *     summary: Trigger a new parse job
 *     description: Creates and queues a new WordPress events parsing job. Returns immediately with a job ID.
 *     tags: [Parse]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               headless:
 *                 type: boolean
 *                 description: Run browser in headless mode
 *                 default: true
 *               closeAfter:
 *                 type: boolean
 *                 description: Close browser after parsing
 *                 default: true
 *     responses:
 *       202:
 *         description: Job queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                   format: uuid
 *                 status:
 *                   type: string
 *                   enum: [pending]
 *                 message:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 statusUrl:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       503:
 *         description: Queue is full
 */
router.post('/', parseController.createJob);

/**
 * @swagger
 * /api/parse/{jobId}:
 *   get:
 *     summary: Get job status
 *     description: Retrieves the current status and result of a parse job
 *     tags: [Parse]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                   format: uuid
 *                 status:
 *                   type: string
 *                   enum: [pending, running, completed, failed]
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 startedAt:
 *                   type: string
 *                   format: date-time
 *                 completedAt:
 *                   type: string
 *                   format: date-time
 *                 result:
 *                   type: object
 *                   properties:
 *                     outputFile:
 *                       type: string
 *                     eventCount:
 *                       type: integer
 *                     screenshotPath:
 *                       type: string
 *                 error:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Job not found
 */
router.get('/:jobId', parseController.getJobStatus);

export default router;
