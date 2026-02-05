export class AppError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public isOperational: boolean = true
    ) {
        super(message);
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super(400, message);
    }
}

export class AuthenticationError extends AppError {
    constructor(message: string = 'Unauthorized') {
        super(401, message);
    }
}

export class NotFoundError extends AppError {
    constructor(message: string) {
        super(404, message);
    }
}

export class ServiceUnavailableError extends AppError {
    constructor(message: string) {
        super(503, message);
    }
}

export class ScraperError extends AppError {
    constructor(message: string, originalError?: Error) {
        super(500, message);
        if (originalError?.stack) {
            this.stack = originalError.stack;
        }
    }
}

export class GoogleSheetsApiError extends AppError {
    constructor(message: string, statusCode: number = 500) {
        super(statusCode, message);
    }
}
