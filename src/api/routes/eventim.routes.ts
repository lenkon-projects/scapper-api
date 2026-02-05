import { Router } from 'express';
import * as eventimController from '../controllers/eventim.controller';

const router = Router();

/**
 * @swagger
 * /api/eventim/parse-and-sync:
 *   post:
 *     summary: Parse Eventim HTML report and sync with Google Sheets
 *     description: |
 *       Synchronously parses an Eventim static HTML report, checks freshness against
 *       previously processed reports, extracts event data, and syncs with Google Sheets.
 *       Returns comprehensive results including parsed events, file paths, and sync status.
 *     tags: [Eventim]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *       - UserTokenAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 pattern: '^https://webreporting\.eventim\.de/webreporting/public/Reports/STR_.*\.html$'
 *                 description: Eventim static HTML report URL
 *                 example: 'https://webreporting.eventim.de/webreporting/public/Reports/STR_429b6ab6-c5de-4341-bdf8-511a57a01418.html'
 *     responses:
 *       200:
 *         description: Request processed successfully (may be skipped or synced)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 parsing:
 *                   type: object
 *                   properties:
 *                     skipped:
 *                       type: boolean
 *                       description: Whether parsing was skipped due to report being old
 *                       example: false
 *                     currentPrintTime:
 *                       type: string
 *                       description: Print time from the HTML report
 *                       example: '12/06/2024 10:30:00 AM'
 *                     lastPrintTime:
 *                       type: string
 *                       description: Print time of last processed report
 *                       example: '12/01/2024 10:30:00 AM'
 *                     eventCount:
 *                       type: integer
 *                       description: Number of events found
 *                       example: 3
 *                     events:
 *                       type: array
 *                       description: Array of parsed events
 *                       items:
 *                         type: object
 *                         properties:
 *                           eventId:
 *                             type: string
 *                             example: '12345'
 *                           title:
 *                             type: string
 *                             example: 'Concert at Arena'
 *                           venue:
 *                             type: string
 *                             example: 'Tel Aviv Arena'
 *                           date:
 *                             type: string
 *                             example: '15.12.2024 20:00'
 *                           ticketsSold:
 *                             type: object
 *                             properties:
 *                               total:
 *                                 type: integer
 *                                 example: 450
 *                               capacity:
 *                                 type: integer
 *                                 example: 500
 *                 files:
 *                   type: object
 *                   description: File paths (only present if not skipped)
 *                   properties:
 *                     outputFile:
 *                       type: string
 *                       example: './output/eventim_report_1733486400000.json'
 *                     screenshotPath:
 *                       type: string
 *                       example: './output/eventim_screenshot_1733486400000.png'
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       example: '2024-12-06T10:00:00.000Z'
 *                     processingTime:
 *                       type: integer
 *                       description: Processing time in milliseconds
 *                       example: 5420
 *                 sync:
 *                   type: object
 *                   description: Google Sheets sync results (only present if not skipped)
 *                   properties:
 *                     totalProcessed:
 *                       type: integer
 *                       example: 3
 *                     successfulUpdates:
 *                       type: integer
 *                       example: 3
 *                     skipped:
 *                       type: integer
 *                       example: 0
 *                     errors:
 *                       type: integer
 *                       example: 0
 *                     details:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           eventId:
 *                             type: string
 *                             example: '12345'
 *                           status:
 *                             type: string
 *                             enum: [updated, skipped, error]
 *                             example: 'updated'
 *                           message:
 *                             type: string
 *                           rowIndex:
 *                             type: integer
 *                             example: 5
 *       400:
 *         description: Invalid request (missing or invalid URL)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Invalid URL format. Expected: https://webreporting.eventim.de/webreporting/public/Reports/STR_*.html'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Unauthorized'
 *       500:
 *         description: Internal server error (parsing or sync failure)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Failed to parse Eventim report'
 */
router.post('/parse-and-sync', eventimController.parseAndSync);

export default router;
