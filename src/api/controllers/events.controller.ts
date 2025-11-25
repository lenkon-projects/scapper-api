import { Request, Response, NextFunction } from 'express';
import EventsService from '../services/events.service';

export const getEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const filename = req.query.file as string | undefined;
        const eventsService = EventsService.getInstance();

        let result;
        if (filename) {
            result = eventsService.getEventsByFile(filename);
        } else {
            result = eventsService.getLatestEvents();
        }

        res.status(200).json({
            source: result.source,
            parsedAt: result.parsedAt.toISOString(),
            eventCount: result.eventCount,
            events: result.events
        });
    } catch (error) {
        next(error);
    }
};

export const listFiles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const eventsService = EventsService.getInstance();
        const files = eventsService.listFiles();

        res.status(200).json({
            files: files.map(file => ({
                filename: file.filename,
                timestamp: file.timestamp,
                parsedAt: file.parsedAt.toISOString(),
                size: file.size
            })),
            totalFiles: files.length
        });
    } catch (error) {
        next(error);
    }
};
