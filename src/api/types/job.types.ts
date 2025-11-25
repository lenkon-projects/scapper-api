import { ParseOptions } from '../../core/types';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface JobResult {
    outputFile: string;
    eventCount: number;
    screenshotPath: string;
}

export interface Job {
    id: string;
    status: JobStatus;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    options?: ParseOptions;
    result?: JobResult;
    error?: string;
}
