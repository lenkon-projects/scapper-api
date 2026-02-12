import { google, sheets_v4 } from "googleapis";
import path from "path";
import { Event } from "../core/types";
import {
  GoogleSheetsConfig,
  SheetRow,
  SheetSyncDetail,
  SheetSyncResult,
} from "../api/types/google-sheets.types";
import { GoogleSheetsApiError } from "../api/types/errors";

class GoogleSheetsService {
  private static instance: GoogleSheetsService;
  private sheets: sheets_v4.Sheets;
  private config: GoogleSheetsConfig;

  private constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
    this.sheets = this.initializeClient();
  }

  public static getInstance(): GoogleSheetsService {
    if (!GoogleSheetsService.instance) {
      GoogleSheetsService.instance = new GoogleSheetsService();
    }
    return GoogleSheetsService.instance;
  }

  private loadConfig(): GoogleSheetsConfig {
    return {
      spreadsheetId:
        process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
        "1vpqx1tsGbH-3ltlSiQNn4_Ui39-KSeb2YTjA_G0IT94",
      sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || "Event_details",
      credentialsPath:
        process.env.GOOGLE_SHEETS_CREDENTIALS_PATH ||
        path.resolve(process.cwd(), "credentials.json"),
    };
  }

  private validateConfig(): void {
    if (!this.config.spreadsheetId) {
      throw new Error(
        "Missing required environment variable: GOOGLE_SHEETS_SPREADSHEET_ID"
      );
    }
  }

  private initializeClient(): sheets_v4.Sheets {
    const auth = new google.auth.GoogleAuth({
      keyFile: this.config.credentialsPath,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth });
  }

  /**
   * Get all items from the Event sheet
   * @returns Array of SheetRow with parsed column data
   */
  public async getAllItems(): Promise<SheetRow[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.sheetName}!A2:I`,
      });

      const rows = response.data.values || [];

      return rows.map((row, index) => ({
        rowIndex: index + 2, // 1-based, +1 for header
        bandName: row[0] || "",
        eventId: row[1] || "",
        eventDate: row[2] || "",
        eventFullNameEng: row[3] || "",
        capacity: parseInt(row[4]) || 0,
        totalTicketsSold: parseInt(row[5]) || 0,
        lastSnapshotAt: row[6] || "",
        eventStatus: row[7] || "",
        eventFullName: row[8] || "",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new GoogleSheetsApiError(`Failed to get items: ${message}`);
    }
  }

  /**
   * Search for a row by event ID
   * @param eventId - The event ID to search for
   * @param prefix - The prefix to use (e.g., "OZ-" or "ZAP-")
   * @returns SheetRow if found, null otherwise
   */
  public async searchItemByEventId(
    eventId: string,
    prefix: string
  ): Promise<SheetRow | null> {
    const searchValue = `${prefix}${eventId}`;
    const items = await this.getAllItems();
    return items.find((item) => item.eventId === searchValue) || null;
  }

  /**
   * Update a row with event data (Capacity, Total_tickets_sold, Last_snapshot_at)
   * @param rowIndex - 1-based row number in the sheet
   * @param event - Event data to update
   * @param timestamp - Timestamp for Last_snapshot_at
   * @returns true if update successful
   */
  public async updateItem(
    rowIndex: number,
    event: Event,
    timestamp: Date
  ): Promise<boolean> {
    const dateStr = this.formatDate(timestamp);

    const range = `${this.config.sheetName}!E${rowIndex}:G${rowIndex}`;
    const values = [
      [
        event.ticketsSold?.capacity || 0,
        event.ticketsSold?.total || 0,
        dateStr,
      ],
    ];

    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new GoogleSheetsApiError(
        `Failed to update row ${rowIndex}: ${message}`
      );
    }
  }

  /**
   * Update event status (column H)
   * @param rowIndex - 1-based row number in the sheet
   * @param status - New status value (e.g., "active", "done", "cancelled")
   * @returns true if update successful
   */
  public async updateEventStatus(
    rowIndex: number,
    status: string
  ): Promise<boolean> {
    const range = `${this.config.sheetName}!H${rowIndex}`;
    const values = [[status]];

    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new GoogleSheetsApiError(
        `Failed to update status for row ${rowIndex}: ${message}`
      );
    }
  }

  /**
   * Sync a single event to Google Sheets
   * @param event - Event to sync
   * @param timestamp - Timestamp for Last_snapshot_at
   * @param prefix - The prefix to use for event ID (e.g., "OZ-" or "ZAP-")
   * @returns Sync detail with status
   */
  public async syncEvent(
    event: Event,
    timestamp: Date,
    prefix: string
  ): Promise<SheetSyncDetail> {
    const eventId = event.eventId || "unknown";

    try {
      const item = await this.searchItemByEventId(eventId, prefix);

      if (!item) {
        return {
          eventId,
          status: "skipped",
          message: "Not found in Google Sheets",
        };
      }

      await this.updateItem(item.rowIndex, event, timestamp);

      return {
        eventId,
        status: "updated",
        rowIndex: item.rowIndex,
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
   * Sync multiple events to Google Sheets
   * Fetches all rows once, then updates matching events
   * @param events - Array of events to sync
   * @param timestamp - Timestamp for Last_snapshot_at
   * @param prefix - The prefix to use for event ID (e.g., "OZ-" or "ZAP-")
   * @returns Sync result summary
   */
  public async syncActiveEvents(
    events: Event[],
    timestamp: Date,
    prefix: string
  ): Promise<SheetSyncResult> {
    const result: SheetSyncResult = {
      totalProcessed: 0,
      successfulUpdates: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    // Fetch all rows once to avoid repeated API calls
    let allItems: SheetRow[];
    try {
      allItems = await this.getAllItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new GoogleSheetsApiError(
        `Failed to fetch sheet data: ${message}`
      );
    }

    for (const event of events) {
      result.totalProcessed++;
      const rawEventId = event.eventId || "unknown";
      const eventIdWithPrefix = `${prefix}${rawEventId}`;

      const item = allItems.find((row) => row.eventId === eventIdWithPrefix);

      const inventory = {
        sold: event.ticketsSold?.total || 0,
        capacity: event.ticketsSold?.capacity,
      };

      if (!item) {
        result.details.push({
          eventId: eventIdWithPrefix,
          title: event.title,
          status: "skipped",
          message: "Not found in Google Sheets",
          inventory,
        });
        result.skipped++;
        continue;
      }

      try {
        await this.updateItem(item.rowIndex, event, timestamp);
        result.details.push({
          eventId: eventIdWithPrefix,
          title: event.title,
          status: "updated",
          rowIndex: item.rowIndex,
          inventory,
        });
        result.successfulUpdates++;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        result.details.push({
          eventId: eventIdWithPrefix,
          title: event.title,
          status: "error",
          message,
          inventory,
        });
        result.errors++;
      }

      // Rate limiting between API calls
      await this.delay(100);
    }

    return result;
  }

  /**
   * Format date as DD/MM/YYYY HH:mm (matching the sheet format)
   */
  private formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  /**
   * Delay helper for rate limiting
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default GoogleSheetsService;
