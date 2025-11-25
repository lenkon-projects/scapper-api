export interface TicketData {
    total?: number;
    capacity?: number;
}

export interface Event {
    active?: boolean;
    eventId?: string;
    ticketsSold?: TicketData;
}

export interface ParseOptions {
    headless?: boolean;
    closeAfter?: boolean;
}

export interface ParseResult {
    events: Event[];
    outputFile: string;
    screenshotPath: string;
}
