import "dotenv/config";
import { TickchakScraper } from "../core/tickchak-scraper";
import GoogleSheetsService from "../services/google-sheets.service";
import { TelegramNotificationService } from "../bot/services/telegram-notification.service";
import { Event } from "../core/types";

/**
 * Parse Tickchak & Sync Script
 *
 * Executes Tickchak parsing directly,
 * then syncs parsed events to Google Sheets.
 *
 * Features:
 * - Tickchak scraping
 * - Converts Tickchak events to sync format
 * - Syncs to Google Sheets with timestamp (Prefix: TC-)
 * - Comprehensive logging throughout
 * - Error notifications via Telegram
 * - Proper error handling with exit codes
 */

async function main() {
  console.log("============================================================");
  console.log("🎫 Tickchak Parse & Sync");
  console.log("============================================================");
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log("");

  try {
    // ========================================
    // Phase 1: Execute Tickchak Parse
    // ========================================
    console.log("[TickchakSync] Phase 1: Starting Tickchak parse...");
    
    const scraper = new TickchakScraper();
    await scraper.login();
    const tickchakEvents = await scraper.getEvents();

    console.log("");
    console.log("[TickchakSync] Parse completed successfully");
    console.log(
      `[TickchakSync] Total events parsed: ${tickchakEvents.length}`
    );
    console.log("");

    // ========================================
    // Phase 2: Convert Events to Generic Format
    // ========================================
    console.log(
      "[TickchakSync] Phase 2: Converting events to generic format..."
    );

    const activeEvents: Event[] = tickchakEvents.map((e) => ({
      active: true, // Assuming fetched events are active
      eventId: e.eid.toString(),
      title: e.title,
      ticketsSold: {
        total: e.tickets.sold,
        capacity: e.tickets.amount,
      },
    }));

    console.log(`[TickchakSync] Converted ${activeEvents.length} events`);

    if (activeEvents.length === 0) {
      console.log("[TickchakSync] No events to sync. Exiting.");
      process.exit(0);
    }

    console.log("");

    // ========================================
    // Phase 3: Sync to Google Sheets
    // ========================================
    const syncTimestamp = new Date();
    console.log("[TickchakSync] Phase 3: Starting sync to Google Sheets...");
    console.log(
      `[TickchakSync] Using sync timestamp: ${syncTimestamp.toISOString()}`
    );
    console.log("");

    const sheetsService = GoogleSheetsService.getInstance();
    
    // Use TC- prefix for Tickchak events
    const result = await sheetsService.syncActiveEvents(
      activeEvents,
      syncTimestamp,
      "TC-"
    );

    // ========================================
    // Phase 4: Log Summary
    // ========================================
    console.log("");
    console.log("─".repeat(60));
    console.log("[TickchakSync] Google Sheets Sync Summary:");
    console.log(`  Total Processed:     ${result.totalProcessed}`);
    console.log(`  Successful Updates:  ${result.successfulUpdates}`);
    console.log(`  Skipped:             ${result.skipped}`);
    console.log(`  Errors:              ${result.errors}`);
    console.log("─".repeat(60));
    console.log("");

    // ========================================
    // Phase 5: Exit with Appropriate Code
    // ========================================
    if (result.errors === result.totalProcessed && result.totalProcessed > 0) {
      console.log("[TickchakSync] All events failed. Exiting with error code.");
      process.exit(1);
    } else {
      console.log("[TickchakSync] Parse and sync completed successfully.");
      process.exit(0);
    }
  } catch (error) {
    console.error("[TickchakSync] Fatal error:");

    let errorObj: Error;
    if (error instanceof Error) {
      errorObj = error;
      console.error(`  Message: ${error.message}`);
      if (error.stack) {
        console.error(`  Stack: ${error.stack}`);
      }
    } else {
      errorObj = new Error(String(error));
      console.error(`  ${error}`);
    }

    // Send notification to all Telegram users
    try {
      console.log(
        "[TickchakSync] Sending error notification to Telegram users..."
      );
      const notificationService = TelegramNotificationService.getInstance();
      const formattedMessage = notificationService.formatErrorMessage(
        errorObj,
        "Tickchak Parse and Sync Script"
      );

      const notifyResult = await notificationService.broadcastToAllUsers(
        formattedMessage
      );
      console.log(
        `[TickchakSync] Notification sent: ${notifyResult.sent} successful, ${notifyResult.failed} failed`
      );

      if (notifyResult.failed > 0) {
        const failedUsers = notifyResult.details
          .filter((d) => !d.success)
          .map((d) => `User ${d.userId}: ${d.error}`)
          .join("\n  ");
        console.error(`[TickchakSync] Failed notifications:\n  ${failedUsers}`);
      }
    } catch (notificationError) {
      // Don't let notification errors crash the script
      console.error(
        "[TickchakSync] Failed to send Telegram notification:",
        notificationError
      );
    }

    process.exit(1);
  }
}

// Run main function
main();
