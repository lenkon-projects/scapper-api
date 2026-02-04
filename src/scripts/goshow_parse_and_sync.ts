import "dotenv/config";
import { GoShowScraper } from "../core/goshow-scraper";
import MondayService from "../api/services/monday.service";
import GoogleSheetsService from "../services/google-sheets.service";
import { TelegramNotificationService } from "../bot/services/telegram-notification.service";
import { Event } from "../core/types";

/**
 * GoShow Parse & Sync Script
 *
 * Executes GoShow Manager parsing,
 * then syncs parsed events to Monday.com board.
 *
 * Features:
 * - GoShow Manager scraping with headless mode
 * - Automatic browser cleanup
 * - Converts GoShow events to Monday.com format
 * - Syncs to Monday.com with timestamp
 * - Comprehensive logging throughout
 * - Error notifications via Telegram
 * - Proper error handling with exit codes
 */

async function main() {
  console.log("============================================================");
  console.log("🎫 GoShow Parse & Sync");
  console.log("============================================================");
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log("");

  try {
    // ========================================
    // Phase 1: Execute GoShow Parse
    // ========================================
    console.log("[GoShowSync] Phase 1: Starting GoShow parse...");
    console.log("[GoShowSync] Parse options: headless=true, closeAfter=true");
    console.log("");

    const scraper = new GoShowScraper({
      headless: true,
      closeAfter: true,
    });

    const parseResult = await scraper.execute();

    console.log("");
    console.log("[GoShowSync] Parse completed successfully");
    console.log(
      `[GoShowSync] Total events parsed: ${parseResult.events.length}`
    );
    console.log(`[GoShowSync] Output file: ${parseResult.outputFile}`);
    console.log(`[GoShowSync] Screenshot: ${parseResult.screenshotPath}`);
    console.log("");

    // ========================================
    // Phase 2: Convert Events to Monday.com Format
    // ========================================
    console.log(
      "[GoShowSync] Phase 2: Converting events to Monday.com format..."
    );

    // All GoShow events are considered active
    const activeEvents: Event[] = parseResult.events.map((e) => ({
      active: true,
      eventId: e.eventId,
      ticketsSold: {
        total: e.ticketsSold.total,
        capacity: e.ticketsSold.capacity,
      },
    }));

    console.log(`[GoShowSync] Converted ${activeEvents.length} events`);

    if (activeEvents.length === 0) {
      console.log("[GoShowSync] No events to sync. Exiting.");
      process.exit(0);
    }

    console.log("");

    // ========================================
    // Phase 3: Initialize Monday.com Service
    // ========================================
    console.log("[GoShowSync] Phase 3: Initializing Monday.com service...");
    const mondayService = MondayService.getInstance();

    // ========================================
    // Phase 4: Sync to Monday.com
    // ========================================
    const syncTimestamp = new Date();
    console.log("[GoShowSync] Phase 4: Starting sync to Monday.com...");
    console.log(
      `[GoShowSync] Using sync timestamp: ${syncTimestamp.toISOString()}`
    );
    console.log("");

    // Use GO- prefix for GoShow events
    const result = await mondayService.syncActiveEvents(
      activeEvents,
      syncTimestamp,
      "GO-"
    );

    // ========================================
    // Phase 5: Log Detailed Results
    // ========================================
    console.log("");
    console.log("[GoShowSync] Sync Details:");
    console.log("─".repeat(60));

    for (const detail of result.details) {
      const eventId = detail.eventId?.padEnd(10) || "unknown".padEnd(10);

      switch (detail.status) {
        case "updated":
          console.log(
            `[GoShowSync] ✓ ${eventId} - Updated (Item: ${detail.mondayItemId})`
          );
          break;
        case "skipped":
          console.log(`[GoShowSync] ⚠ ${eventId} - Skipped: ${detail.message}`);
          break;
        case "error":
          console.log(`[GoShowSync] ✗ ${eventId} - Error: ${detail.message}`);
          break;
      }
    }

    // ========================================
    // Phase 6: Log Summary
    // ========================================
    console.log("");
    console.log("─".repeat(60));
    console.log("[GoShowSync] Summary:");
    console.log(`  Total Processed:     ${result.totalProcessed}`);
    console.log(`  Successful Updates:  ${result.successfulUpdates}`);
    console.log(`  Skipped:             ${result.skipped}`);
    console.log(`  Errors:              ${result.errors}`);
    console.log("─".repeat(60));
    console.log("");

    // ========================================
    // Phase 7: Sync to Google Sheets
    // ========================================
    console.log("[GoShowSync] Phase 7: Starting sync to Google Sheets...");
    try {
      const sheetsService = GoogleSheetsService.getInstance();
      const sheetsResult = await sheetsService.syncActiveEvents(
        activeEvents,
        syncTimestamp,
        "GO-"
      );

      console.log("[GoShowSync] Google Sheets Sync Summary:");
      console.log(`  Successful Updates:  ${sheetsResult.successfulUpdates}`);
      console.log(`  Skipped:             ${sheetsResult.skipped}`);
      console.log(`  Errors:              ${sheetsResult.errors}`);
      console.log("─".repeat(60));
      console.log("");
    } catch (sheetsError) {
      console.error("[GoShowSync] Google Sheets sync failed:", sheetsError);
    }

    // ========================================
    // Phase 8: Exit with Appropriate Code
    // ========================================
    if (result.errors === result.totalProcessed && result.totalProcessed > 0) {
      console.log("[GoShowSync] All events failed. Exiting with error code.");
      process.exit(1);
    } else {
      console.log("[GoShowSync] Parse and sync completed successfully.");
      process.exit(0);
    }
  } catch (error) {
    console.error("[GoShowSync] Fatal error:");

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
        "[GoShowSync] Sending error notification to Telegram users..."
      );
      const notificationService = TelegramNotificationService.getInstance();
      const formattedMessage = notificationService.formatErrorMessage(
        errorObj,
        "GoShow Parse and Sync Script"
      );

      const notifyResult = await notificationService.broadcastToAllUsers(
        formattedMessage
      );
      console.log(
        `[GoShowSync] Notification sent: ${notifyResult.sent} successful, ${notifyResult.failed} failed`
      );

      if (notifyResult.failed > 0) {
        const failedUsers = notifyResult.details
          .filter((d) => !d.success)
          .map((d) => `User ${d.userId}: ${d.error}`)
          .join("\n  ");
        console.error(`[GoShowSync] Failed notifications:\n  ${failedUsers}`);
      }
    } catch (notificationError) {
      // Don't let notification errors crash the script
      console.error(
        "[GoShowSync] Failed to send Telegram notification:",
        notificationError
      );
    }

    process.exit(1);
  }
}

// Run main function
main();
