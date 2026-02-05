import { Request, Response, NextFunction } from 'express';
import { ValidationError, ScraperError } from '../types/errors';
import { EventimParseAndSyncRequest, EventimParseAndSyncResponse } from '../types/eventim-api.types';
import { EventimScraper } from '../../core/eventim-scraper';
import GoogleSheetsService from '../../services/google-sheets.service';
import { Event } from '../../core/types';

/**
 * Parse Eventim HTML report and sync with Google Sheets
 */
export const parseAndSync = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();

  try {
    // 1. Validate request
    const body: EventimParseAndSyncRequest = req.body;

    if (!body.url) {
      throw new ValidationError('Missing required field: url');
    }

    // Validate URL format
    const urlPattern = /^https:\/\/webreporting\.eventim\.de\/webreporting\/public\/Reports\/STR_.*\.html$/;
    if (!urlPattern.test(body.url)) {
      throw new ValidationError(
        'Invalid URL format. Expected: https://webreporting.eventim.de/webreporting/public/Reports/STR_*.html'
      );
    }

    // 2. Parse from URL with freshness check
    const checkResult = await EventimScraper.parseFromUrlWithCheck(body.url);

    // 3. If skipped, return early with skip information
    if (checkResult.skipped) {
      const response: EventimParseAndSyncResponse = {
        parsing: {
          skipped: true,
          currentPrintTime: checkResult.currentPrintTime,
          lastPrintTime: checkResult.lastPrintTime,
          eventCount: 0,
          events: [],
        },
        metadata: {
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
        },
      };

      res.status(200).json(response);
      return;
    }

    // 4. Extract parse result
    const parseResult = checkResult.result;
    if (!parseResult) {
      throw new ScraperError('Unexpected: result is null but not skipped');
    }

    // 5. Convert EventimEvent[] to Event[] (all Eventim events are active)
    const activeEvents: Event[] = parseResult.events.map((e) => ({
      active: true,
      eventId: e.eventId,
      ticketsSold: {
        total: e.ticketsSold.total,
        capacity: e.ticketsSold.capacity,
      },
    }));

    // 6. Sync with Google Sheets (if events exist)
    let syncResults;
    if (activeEvents.length > 0) {
      const syncTimestamp = new Date();

      const sheetsService = GoogleSheetsService.getInstance();
      syncResults = await sheetsService.syncActiveEvents(
        activeEvents,
        syncTimestamp,
        'ZAP-'
      );
    }

    // 7. Build comprehensive response
    const response: EventimParseAndSyncResponse = {
      parsing: {
        skipped: false,
        currentPrintTime: checkResult.currentPrintTime,
        lastPrintTime: checkResult.lastPrintTime,
        eventCount: parseResult.events.length,
        events: parseResult.events,
      },
      files: {
        outputFile: parseResult.outputFile,
        screenshotPath: parseResult.screenshotPath,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime,
      },
      sync: syncResults,
    };

    res.status(200).json(response);
  } catch (error) {
    // Pass to error middleware
    next(error);
  }
};
