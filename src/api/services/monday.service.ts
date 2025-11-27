import axios, { AxiosInstance } from "axios";
import { Event } from "../../core/types";
import {
  MondayApiResponse,
  MondayItem,
  ItemsSearchResponse,
  ChangeMultipleColumnValuesResponse,
  SyncDetail,
  SyncResult,
  MondayConfig,
} from "../types/monday.types";
import { MondayApiError } from "../types/errors";

class MondayService {
  private static instance: MondayService;
  private client: AxiosInstance;
  private config: MondayConfig;

  private constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
    this.client = this.initializeClient();
  }

  public static getInstance(): MondayService {
    if (!MondayService.instance) {
      MondayService.instance = new MondayService();
    }
    return MondayService.instance;
  }

  private loadConfig(): MondayConfig {
    return {
      apiKey: process.env.MONDAY_COM_API_KEY || "",
      boardId: process.env.MONDAY_COM_BOARD_ID || "5086703491",
      apiUrl: process.env.MONDAY_COM_API_URL || "https://api.monday.com/v2",
      timeout: parseInt(process.env.MONDAY_COM_TIMEOUT || "10000"),
      eventIdColumn: process.env.MONDAY_COM_EVENT_ID_COLUMN || "text_mkxy6ra8",
      capacityColumn:
        process.env.MONDAY_COM_CAPACITY_COLUMN || "numeric_mkxst6mx",
      ticketsSoldColumn:
        process.env.MONDAY_COM_TICKETS_SOLD_COLUMN || "numeric_mkxsf3c8",
      updateDateColumn:
        process.env.MONDAY_COM_UPDATE_DATE_COLUMN || "date_mky2adca",
    };
  }

  private validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error(
        "Missing required environment variable: MONDAY_COM_API_KEY"
      );
    }
    if (!this.config.boardId) {
      throw new Error(
        "Missing required environment variable: MONDAY_COM_BOARD_ID"
      );
    }
  }

  private initializeClient(): AxiosInstance {
    return axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        "Content-Type": "application/json",
        Authorization: this.config.apiKey,
        "API-Version": "2025-07",
      },
    });
  }

  /**
   * Search for a Monday.com item by event ID
   * @param eventId - The event ID to search for
   * @param prefix - The prefix to use (e.g., "OZ-" or "ZAP-")
   * @returns Monday.com item if found, null otherwise
   */
  public async searchItemByEventId(
    eventId: string,
    prefix: string
  ): Promise<MondayItem | null> {
    const searchValue = `${prefix}${eventId}`;

    const query = `
            query SearchItem($boardId: ID!, $columnId: String!, $value: String!) {
                items_page_by_column_values(
                    board_id: $boardId
                    columns: [{ column_id: $columnId, column_values: [$value] }]
                ) {
                    items {
                        id
                        name
                    }
                }
            }
        `;

    const variables = {
      boardId: this.config.boardId,
      columnId: this.config.eventIdColumn,
      value: searchValue,
    };

    try {
      const response = await this.client.post<
        MondayApiResponse<ItemsSearchResponse>
      >("", {
        query,
        variables,
      });

      if (response.data.errors && response.data.errors.length > 0) {
        const errorMessages = response.data.errors
          .map((e) => e.message)
          .join(", ");
        throw new MondayApiError(`Monday.com API error: ${errorMessages}`);
      }

      const items = response.data.data.items_page_by_column_values.items;

      if (items.length === 0) {
        return null;
      }

      // Return first match
      return items[0];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status || 500;
        const message = error.response?.data?.error_message || error.message;
        throw new MondayApiError(
          `Failed to search item: ${message}`,
          statusCode
        );
      }
      throw error;
    }
  }

  /**
   * Update Monday.com item with event data
   * @param itemId - Monday.com item ID
   * @param event - Event data to update
   * @param timestamp - Timestamp to use for update date
   * @returns true if update successful
   */
  public async updateItem(
    itemId: string,
    event: Event,
    timestamp: Date
  ): Promise<boolean> {
    const dateStr = timestamp.toISOString().replace("T", " ").substring(0, 19);

    // Build column values object
    const columnValuesObj: Record<string, any> = {
      [this.config.capacityColumn]: event.ticketsSold?.capacity || 0,
      [this.config.ticketsSoldColumn]: event.ticketsSold?.total || 0,
      [this.config.updateDateColumn]: dateStr,
    };

    // Monday.com requires stringified JSON for column_values
    const columnValues = JSON.stringify(columnValuesObj);

    const mutation = `
            mutation UpdateItem($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
                change_multiple_column_values(
                    board_id: $boardId
                    item_id: $itemId
                    column_values: $columnValues
                ) {
                    id
                }
            }
        `;

    const variables = {
      boardId: this.config.boardId,
      itemId: itemId,
      columnValues: columnValues,
    };

    try {
      const response = await this.client.post<
        MondayApiResponse<ChangeMultipleColumnValuesResponse>
      >("", {
        query: mutation,
        variables,
      });

      if (response.data.errors && response.data.errors.length > 0) {
        const errorMessages = response.data.errors
          .map((e) => e.message)
          .join(", ");
        throw new MondayApiError(`Monday.com API error: ${errorMessages}`);
      }

      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status || 500;
        const message = error.response?.data?.error_message || error.message;
        throw new MondayApiError(
          `Failed to update item: ${message}`,
          statusCode
        );
      }
      throw error;
    }
  }

  /**
   * Sync a single event to Monday.com
   * @param event - Event to sync
   * @param timestamp - Timestamp to use for update date
   * @param prefix - The prefix to use for event ID (e.g., "OZ-" or "ZAP-")
   * @returns Sync detail with status
   */
  public async syncEvent(
    event: Event,
    timestamp: Date,
    prefix: string
  ): Promise<SyncDetail> {
    const eventId = event.eventId || "unknown";

    try {
      // Search for item
      const item = await this.searchItemByEventId(eventId, prefix);

      if (!item) {
        return {
          eventId,
          status: "skipped",
          message: "Not found in Monday.com",
        };
      }

      // Update item
      await this.updateItem(item.id, event, timestamp);

      return {
        eventId,
        status: "updated",
        mondayItemId: item.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        eventId,
        status: "error",
        message,
      };
    }
  }

  /**
   * Sync multiple events to Monday.com
   * @param events - Array of events to sync
   * @param timestamp - Timestamp to use for update date
   * @param prefix - The prefix to use for event ID (e.g., "OZ-" or "ZAP-")
   * @returns Sync result summary
   */
  public async syncActiveEvents(
    events: Event[],
    timestamp: Date,
    prefix: string
  ): Promise<SyncResult> {
    const result: SyncResult = {
      totalProcessed: 0,
      successfulUpdates: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    for (const event of events) {
      result.totalProcessed++;

      const detail = await this.syncEvent(event, timestamp, prefix);
      result.details.push(detail);

      switch (detail.status) {
        case "updated":
          result.successfulUpdates++;
          break;
        case "skipped":
          result.skipped++;
          break;
        case "error":
          result.errors++;
          break;
      }

      // Add delay to respect rate limits
      await this.delay(150);
    }

    return result;
  }

  /**
   * Delay helper for rate limiting
   * @param ms - Milliseconds to delay
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default MondayService;
