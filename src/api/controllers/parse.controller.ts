import { Request, Response, NextFunction } from 'express';
import ParseService from '../services/parse.service';
import JobService from '../services/job.service';
import { NotFoundError } from '../types/errors';
import { CreateJobRequest } from '../types/api.types';

export const createJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const body: CreateJobRequest = req.body;

        const options = {
            headless: body.headless ?? true,
            closeAfter: body.closeAfter ?? true
        };

        const parseService = ParseService.getInstance();
        const jobId = parseService.createAndExecuteJob(options);

        const jobService = JobService.getInstance();
        const job = jobService.getJob(jobId);

        if (!job) {
            throw new Error('Failed to create job');
        }

        res.status(202).json({
            jobId: job.id,
            status: job.status,
            message: 'Parse job queued successfully',
            createdAt: job.createdAt.toISOString(),
            statusUrl: `/api/parse/${job.id}`
        });
    } catch (error) {
        next(error);
    }
};

export const getJobStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const jobId = req.params.jobId;

        const jobService = JobService.getInstance();
        const job = jobService.getJob(jobId);

        if (!job) {
            throw new NotFoundError(`Job not found: ${jobId}`);
        }

        const response: any = {
            jobId: job.id,
            status: job.status,
            createdAt: job.createdAt.toISOString()
        };

        if (job.startedAt) {
            response.startedAt = job.startedAt.toISOString();
        }

        if (job.completedAt) {
            response.completedAt = job.completedAt.toISOString();
        }

        if (job.result) {
            response.result = job.result;
        }

        if (job.error) {
            response.error = job.error;
        }

        res.status(200).json(response);
    } catch (error) {
        next(error);
    }
};
