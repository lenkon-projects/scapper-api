import * as fs from 'fs';
import * as path from 'path';
import { Event } from '../../core/types';
import { NotFoundError, ValidationError } from '../types/errors';

interface EventFile {
    filename: string;
    timestamp: number;
    parsedAt: Date;
    size: number;
}

interface EventsResponse {
    source: string;
    parsedAt: Date;
    eventCount: number;
    events: Event[];
}

class EventsService {
    private static instance: EventsService;
    private outputDir: string = './output';

    private constructor() {}

    public static getInstance(): EventsService {
        if (!EventsService.instance) {
            EventsService.instance = new EventsService();
        }
        return EventsService.instance;
    }

    public listFiles(): EventFile[] {
        if (!fs.existsSync(this.outputDir)) {
            return [];
        }

        const files = fs.readdirSync(this.outputDir)
            .filter(file => file.startsWith('events_') && file.endsWith('.json'))
            .map(filename => {
                const filepath = path.join(this.outputDir, filename);
                const stats = fs.statSync(filepath);
                const timestampMatch = filename.match(/events_(\d+)\.json/);
                const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : 0;

                return {
                    filename,
                    timestamp,
                    parsedAt: new Date(timestamp),
                    size: stats.size
                };
            })
            .sort((a, b) => b.timestamp - a.timestamp); // Most recent first

        return files;
    }

    public getLatestEvents(): EventsResponse {
        const files = this.listFiles();

        if (files.length === 0) {
            throw new NotFoundError('No event files found. Please run a parse job first.');
        }

        const latestFile = files[0];
        return this.getEventsByFile(latestFile.filename);
    }

    public getEventsByFile(filename: string): EventsResponse {
        // Validate filename to prevent directory traversal
        if (!filename.match(/^events_\d+\.json$/)) {
            throw new ValidationError('Invalid filename format');
        }

        const filepath = path.join(this.outputDir, filename);

        if (!fs.existsSync(filepath)) {
            throw new NotFoundError(`File ${filename} not found`);
        }

        try {
            const content = fs.readFileSync(filepath, 'utf-8');
            const events: Event[] = JSON.parse(content);

            const timestampMatch = filename.match(/events_(\d+)\.json/);
            const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : 0;

            return {
                source: filename,
                parsedAt: new Date(timestamp),
                eventCount: events.length,
                events
            };
        } catch (error) {
            throw new Error(`Failed to read or parse file: ${filename}`);
        }
    }
}

export default EventsService;
