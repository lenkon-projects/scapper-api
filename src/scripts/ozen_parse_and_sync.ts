import "dotenv/config";
import { executeParse } from "../core/scraper";
import MondayService from "../api/services/monday.service";
import { TelegramNotificationService } from "../bot/services/telegram-notification.service";

/**
 * Parse & Sync Script
 *
 * Executes WordPress parsing directly (bypasses job queue system),
 * then syncs parsed active events to Monday.com board.
 *
 * Features:
 * - Direct WordPress scraping with headless: true
 * - Automatic browser cleanup with closeAfter: true
 * - Filters for active events only
 * - Syncs to Monday.com with timestamp
 * - Comprehensive logging throughout
 * - Proper error handling with exit codes
 */

async function main() {
  console.log("[ParseAndSync] Starting parse and sync process...");
  console.log(`[ParseAndSync] Timestamp: ${new Date().toISOString()}`);
  console.log("");

  try {
    // ========================================
    // Phase 1: Execute WordPress Parse
    // ========================================
    console.log("[ParseAndSync] Starting WordPress parse...");
    console.log("[ParseAndSync] Parse options: headless=true, closeAfter=true");
    console.log("");

    const parseResult = await executeParse({
      headless: true,
      closeAfter: true,
    });

    console.log("");
    console.log("[ParseAndSync] Parse completed successfully");
    console.log(
      `[ParseAndSync] Total events parsed: ${parseResult.events.length}`
    );
    console.log(
      `[ParseAndSync] Output file: ./output/${parseResult.outputFile}`
    );
    console.log(
      `[ParseAndSync] Screenshot: ./output/${parseResult.screenshotPath}`
    );
    console.log("");

    // ========================================
    // Phase 2: Filter Active Events
    // ========================================
    console.log("[ParseAndSync] Filtering active events...");
    const activeEvents = parseResult.events.filter((e) => e.active === true);
    console.log(
      `[ParseAndSync] Found ${activeEvents.length} active events out of ${parseResult.events.length} total`
    );

    if (activeEvents.length === 0) {
      console.log("[ParseAndSync] No active events to sync. Exiting.");
      process.exit(0);
    }

    console.log("");

    // ========================================
    // Phase 3: Initialize Monday.com Service
    // ========================================
    console.log("[ParseAndSync] Initializing Monday.com service...");
    const mondayService = MondayService.getInstance();

    // ========================================
    // Phase 4: Sync to Monday.com
    // ========================================
    const syncTimestamp = new Date();
    console.log("[ParseAndSync] Starting sync to Monday.com...");
    console.log(
      `[ParseAndSync] Using sync timestamp: ${syncTimestamp.toISOString()}`
    );
    console.log("");

    // Use OZ- prefix for WordPress/OZ events
    const result = await mondayService.syncActiveEvents(
      activeEvents,
      syncTimestamp,
      "OZ-"
    );

    // ========================================
    // Phase 5: Log Detailed Results
    // ========================================
    console.log("");
    console.log("[ParseAndSync] Sync Details:");
    console.log("─".repeat(60));

    for (const detail of result.details) {
      const eventId = detail.eventId?.padEnd(10) || "unknown".padEnd(10);

      switch (detail.status) {
        case "updated":
          console.log(
            `[ParseAndSync] ✓ ${eventId} - Updated (Item: ${detail.mondayItemId})`
          );
          break;
        case "skipped":
          console.log(
            `[ParseAndSync] ⚠ ${eventId} - Skipped: ${detail.message}`
          );
          break;
        case "error":
          console.log(`[ParseAndSync] ✗ ${eventId} - Error: ${detail.message}`);
          break;
      }
    }

    // ========================================
    // Phase 6: Log Summary
    // ========================================
    console.log("");
    console.log("─".repeat(60));
    console.log("[ParseAndSync] Summary:");
    console.log(`  Total Processed:     ${result.totalProcessed}`);
    console.log(`  Successful Updates:  ${result.successfulUpdates}`);
    console.log(`  Skipped:             ${result.skipped}`);
    console.log(`  Errors:              ${result.errors}`);
    console.log("─".repeat(60));
    console.log("");

    // ========================================
    // Phase 7: Exit with Appropriate Code
    // ========================================
    if (result.errors === result.totalProcessed) {
      console.log("[ParseAndSync] All events failed. Exiting with error code.");
      process.exit(1);
    } else {
      console.log("[ParseAndSync] Parse and sync completed successfully.");
      process.exit(0);
    }
  } catch (error) {
    console.error("[ParseAndSync] Fatal error:");

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
        "[ParseAndSync] Sending error notification to Telegram users..."
      );
      const notificationService = TelegramNotificationService.getInstance();
      const formattedMessage = notificationService.formatErrorMessage(
        errorObj,
        "Parse and Sync Script"
      );

      const result = await notificationService.broadcastToAllUsers(
        formattedMessage
      );
      console.log(
        `[ParseAndSync] Notification sent: ${result.sent} successful, ${result.failed} failed`
      );

      if (result.failed > 0) {
        const failedUsers = result.details
          .filter((d) => !d.success)
          .map((d) => `User ${d.userId}: ${d.error}`)
          .join("\n  ");
        console.error(`[ParseAndSync] Failed notifications:\n  ${failedUsers}`);
      }
    } catch (notificationError) {
      // Don't let notification errors crash the script
      console.error(
        "[ParseAndSync] Failed to send Telegram notification:",
        notificationError
      );
    }

    process.exit(1);
  }
}

// Run main function
main();
