import { ParseOptions } from '../../core/types';

export interface CreateJobRequest {
    headless?: boolean;
    closeAfter?: boolean;
}

export interface CreateJobResponse {
    jobId: string;
    status: string;
    message: string;
    createdAt: string;
    statusUrl: string;
}

export interface JobStatusResponse {
    jobId: string;
    status: string;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    result?: {
        outputFile: string;
        eventCount: number;
        screenshotPath: string;
    };
    error?: string;
}

export interface ErrorResponse {
    error: string;
    message?: string;
}
