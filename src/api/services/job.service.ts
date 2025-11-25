import { v4 as uuidv4 } from 'uuid';
import { Job, JobStatus, JobResult } from '../types/job.types';
import { ParseOptions } from '../../core/types';
import { ServiceUnavailableError } from '../types/errors';

class JobService {
    private static instance: JobService;
    private jobs: Map<string, Job> = new Map();
    private queue: string[] = [];
    private isProcessing: boolean = false;
    private maxQueueSize: number;
    private jobTimeoutMs: number;
    private cleanupIntervalMs: number;
    private cleanupTimer?: NodeJS.Timeout;

    private constructor() {
        this.maxQueueSize = parseInt(process.env.MAX_QUEUE_SIZE || '5');
        this.jobTimeoutMs = parseInt(process.env.JOB_TIMEOUT_MS || '300000');
        this.cleanupIntervalMs = parseInt(process.env.JOB_CLEANUP_INTERVAL_MS || '3600000');

        // Start cleanup timer
        this.startCleanupTimer();
    }

    public static getInstance(): JobService {
        if (!JobService.instance) {
            JobService.instance = new JobService();
        }
        return JobService.instance;
    }

    public createJob(options?: ParseOptions): Job {
        if (this.queue.length >= this.maxQueueSize) {
            throw new ServiceUnavailableError(
                `Queue is full. Maximum ${this.maxQueueSize} jobs allowed.`
            );
        }

        const job: Job = {
            id: uuidv4(),
            status: 'pending',
            createdAt: new Date(),
            options
        };

        this.jobs.set(job.id, job);
        this.queue.push(job.id);

        // Start processing if not already
        if (!this.isProcessing) {
            this.processQueue();
        }

        return job;
    }

    public getJob(jobId: string): Job | null {
        return this.jobs.get(jobId) || null;
    }

    public getAllJobs(): Job[] {
        return Array.from(this.jobs.values());
    }

    public updateJobStatus(
        jobId: string,
        status: JobStatus,
        result?: JobResult,
        error?: string
    ): void {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.status = status;

        if (status === 'running') {
            job.startedAt = new Date();
        }

        if (status === 'completed' || status === 'failed') {
            job.completedAt = new Date();
            if (result) {
                job.result = result;
            }
            if (error) {
                job.error = error;
            }
        }

        this.jobs.set(jobId, job);
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.queue.length > 0) {
            const jobId = this.queue.shift();
            if (!jobId) continue;

            const job = this.jobs.get(jobId);
            if (!job) continue;

            console.log(`[JobService] Processing job ${jobId}`);

            // Job will be processed by ParseService
            // which will call updateJobStatus

            // Wait for job to complete (polling with timeout)
            await this.waitForJobCompletion(jobId);
        }

        this.isProcessing = false;
    }

    private async waitForJobCompletion(jobId: string): Promise<void> {
        const startTime = Date.now();
        const pollInterval = 1000; // Check every second

        while (true) {
            const job = this.jobs.get(jobId);
            if (!job) break;

            if (job.status === 'completed' || job.status === 'failed') {
                break;
            }

            if (Date.now() - startTime > this.jobTimeoutMs) {
                this.updateJobStatus(jobId, 'failed', undefined, 'Job timeout exceeded');
                break;
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
    }

    public notifyJobReady(jobId: string): void {
        // Trigger processing for this specific job
        // This will be called by ParseService when it starts processing
        const job = this.jobs.get(jobId);
        if (job && job.status === 'pending') {
            this.updateJobStatus(jobId, 'running');
        }
    }

    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanupOldJobs();
        }, this.cleanupIntervalMs);
    }

    private cleanupOldJobs(): void {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        for (const [jobId, job] of this.jobs.entries()) {
            if (job.status === 'completed' || job.status === 'failed') {
                const age = now - job.createdAt.getTime();
                if (age > maxAge) {
                    console.log(`[JobService] Cleaning up old job ${jobId}`);
                    this.jobs.delete(jobId);
                }
            }
        }
    }

    public getQueueSize(): number {
        return this.queue.length;
    }

    public stopCleanup(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
    }
}

export default JobService;
