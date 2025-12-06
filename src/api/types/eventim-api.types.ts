import { EventimEvent } from '../../core/eventim.types';
import { SyncResult } from './monday.types';

/**
 * Request body for POST /api/eventim/parse-and-sync
 */
export interface EventimParseAndSyncRequest {
  url: string;
}

/**
 * Response for POST /api/eventim/parse-and-sync
 * Includes parsing information, file paths, metadata, and Monday.com sync results
 */
export interface EventimParseAndSyncResponse {
  /**
   * Parsing information
   */
  parsing: {
    /**
     * Whether the report was skipped due to being old
     */
    skipped: boolean;

    /**
     * Print time from the current HTML report
     */
    currentPrintTime?: string;

    /**
     * Print time from the last processed report
     */
    lastPrintTime?: string;

    /**
     * Number of events found in the report
     */
    eventCount: number;

    /**
     * Array of parsed events
     */
    events: EventimEvent[];
  };

  /**
   * File paths (only present if not skipped)
   */
  files?: {
    /**
     * Path to the output JSON file
     */
    outputFile: string;

    /**
     * Path to the screenshot file (if available)
     */
    screenshotPath?: string;
  };

  /**
   * Metadata about the request
   */
  metadata: {
    /**
     * ISO timestamp of when the request was processed
     */
    timestamp: string;

    /**
     * Processing time in milliseconds
     */
    processingTime?: number;
  };

  /**
   * Monday.com sync results (only present if not skipped)
   */
  sync?: SyncResult;
}
