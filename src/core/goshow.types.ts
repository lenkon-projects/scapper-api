/**
 * GoShow Manager Parser Types
 */

export interface GoShowParseOptions {
  headless?: boolean;
  closeAfter?: boolean;
}

export interface GoShowTicketData {
  total: number; // נמכרו דרך האתר (sold through website)
  capacity: number; // הוקצו למכירה (allocated for sale)
}

export interface GoShowEvent {
  eventId: string;
  title?: string;
  venue?: string;
  date?: string;
  ticketsSold: GoShowTicketData;
}

export interface GoShowParseResult {
  events: GoShowEvent[];
  outputFile: string;
  screenshotPath: string;
  timestamp: string;
}
