/**
 * Eventim WebReporting Parser Types
 */

export interface EventimParseOptions {
  headless?: boolean;
  closeAfter?: boolean;
}

export interface EventimReportRow {
  [key: string]: string;
}

export interface EventimTicketData {
  total: number;
  capacity: number;
}

export interface EventimEvent {
  eventId: string;
  title?: string;
  venue?: string;
  date?: string;
  ticketsSold: EventimTicketData;
}

export interface EventimParseResult {
  events: EventimEvent[];
  rawRows?: EventimReportRow[];
  headers?: string[];
  outputFile: string;
  screenshotPath: string;
  timestamp: string;
}
