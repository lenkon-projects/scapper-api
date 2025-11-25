import { executeParse } from '../../core/scraper';
import { ParseOptions } from '../../core/types';
import JobService from './job.service';
import { ScraperError } from '../types/errors';

class ParseService {
    private static instance: ParseService;
    private jobService: JobService;

    private constructor() {
        this.jobService = JobService.getInstance();
    }

    public static getInstance(): ParseService {
        if (!ParseService.instance) {
            ParseService.instance = new ParseService();
        }
        return ParseService.instance;
    }

    public async executeParseJob(jobId: string): Promise<void> {
        const job = this.jobService.getJob(jobId);
        if (!job) {
            console.error(`[ParseService] Job ${jobId} not found`);
            return;
        }

        try {
            console.log(`[ParseService] Starting job ${jobId}`);
            this.jobService.updateJobStatus(jobId, 'running');

            const result = await executeParse(job.options || {});

            console.log(`[ParseService] Job ${jobId} completed successfully`);
            this.jobService.updateJobStatus(jobId, 'completed', {
                outputFile: result.outputFile,
                eventCount: result.events.length,
                screenshotPath: result.screenshotPath
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[ParseService] Job ${jobId} failed:`, errorMessage);

            this.jobService.updateJobStatus(
                jobId,
                'failed',
                undefined,
                errorMessage
            );
        }
    }

    public createAndExecuteJob(options?: ParseOptions): string {
        const job = this.jobService.createJob(options);

        // Execute job asynchronously (don't await)
        this.executeParseJob(job.id).catch(error => {
            console.error(`[ParseService] Unexpected error in job ${job.id}:`, error);
        });

        return job.id;
    }
}

export default ParseService;
