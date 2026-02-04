import "dotenv/config";
import ZygoScraper from "../core/zygo-scraper";
import MondayService from "../api/services/monday.service";
import GoogleSheetsService from "../services/google-sheets.service";
import { TelegramNotificationService } from "../bot/services/telegram-notification.service";
import { Event } from "../core/types";
import ZygoTokenService from "../services/zygo-token.service";

/**
 * Zygo Parse & Sync Script
 *
 * Executes Zygo API parsing,
 * then syncs parsed events to Monday.com board.
 *
 * Features:
 * - Zygo API scraping (no browser required)
 * - Filters only upcoming events
 * - Converts Zygo events to Monday.com format
 * - Syncs to Monday.com with timestamp
 * - Comprehensive logging throughout
 * - Error notifications via Telegram
 * - Proper error handling with exit codes
 */

async function main() {
  console.log("============================================================");
  console.log("🏆 Zygo Parse & Sync");
  console.log("============================================================");
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log("");

  try {
    // ========================================
    // Phase 0: Validate Token
    // ========================================
    console.log("[ZygoSync] Phase 0: Validating Zygo authentication...");
    const tokenService = ZygoTokenService.getInstance();
    const tokenStatus = tokenService.getTokenStatus();

    // Проверка наличия токенов
    if (!tokenStatus.hasTokens) {
      console.log("[ZygoSync] ⚠️  No tokens found. Exiting silently.");
      console.log("[ZygoSync] ℹ️  Please authorize via /zygo_auth command.");
      process.exit(0);
    }

    // Проверка флага невалидности refresh токена
    if (tokenStatus.isRefreshTokenInvalid) {
      console.log("[ZygoSync] ⚠️  Refresh token is invalid. Exiting silently.");
      console.log("[ZygoSync] ℹ️  Please re-authorize via /zygo_auth command.");
      process.exit(0);
    }

    // Попытка обновить токен если требуется
    try {
      await tokenService.getAccessToken();
    } catch (tokenError: any) {
      // Если токен не удалось обновить, выходим молча
      console.log("[ZygoSync] ⚠️  Failed to refresh access token. Exiting silently.");
      console.log("[ZygoSync] ℹ️  Please re-authorize via /zygo_auth command.");
      process.exit(0);
    }

    console.log("[ZygoSync] ✅ Token validation successful");
    console.log("");

    // ========================================
    // Phase 1: Execute Zygo API Fetch
    // ========================================
    console.log("[ZygoSync] Phase 1: Starting Zygo API fetch...");
    console.log("");

    const scraper = new ZygoScraper();

    const events = await scraper.getManagedEvents(false); // past=false для будущих событий

    console.log("");
    console.log("[ZygoSync] API fetch completed successfully");
    console.log(`[ZygoSync] Total managed events fetched: ${events.length}`);
    console.log("");

    if (events.length === 0) {
      console.log("[ZygoSync] No managed events found. Exiting.");
      process.exit(0);
    }

    // ========================================
    // Phase 2: Filter Upcoming Events
    // ========================================
    console.log("[ZygoSync] Phase 2: Filtering upcoming events...");

    const now = new Date();
    const upcomingEvents = events.filter(
      (e) => new Date(e.startDate) > now
    );

    console.log(`[ZygoSync] Upcoming events: ${upcomingEvents.length}`);
    console.log("");

    if (upcomingEvents.length === 0) {
      console.log("[ZygoSync] No upcoming events to sync. Exiting.");
      process.exit(0);
    }

    // ========================================
    // Phase 3: Convert Events to Monday.com Format
    // ========================================
    console.log(
      "[ZygoSync] Phase 3: Converting events to Monday.com format..."
    );

    // All upcoming Zygo managed events with analytics
    const activeEvents: Event[] = upcomingEvents.map((e: any) => ({
      active: true,
      eventId: e.identifier,
      ticketsSold: {
        total: e.analytics?.approved || 0, // Реальное количество проданных билетов
        // capacity НЕ передаётся - заполняется в Monday.com вручную
      },
    }));

    console.log(`[ZygoSync] Converted ${activeEvents.length} events`);
    console.log("");

    // ========================================
    // Phase 4: Initialize Monday.com Service
    // ========================================
    console.log("[ZygoSync] Phase 4: Initializing Monday.com service...");
    const mondayService = MondayService.getInstance();

    // ========================================
    // Phase 5: Sync to Monday.com
    // ========================================
    const syncTimestamp = new Date();
    console.log("[ZygoSync] Phase 5: Starting sync to Monday.com...");
    console.log(
      `[ZygoSync] Using sync timestamp: ${syncTimestamp.toISOString()}`
    );
    console.log("");

    // Use ZY- prefix for Zygo events
    const result = await mondayService.syncActiveEvents(
      activeEvents,
      syncTimestamp,
      "ZY-"
    );

    // ========================================
    // Phase 6: Log Detailed Results
    // ========================================
    console.log("");
    console.log("[ZygoSync] Sync Details:");
    console.log("─".repeat(60));

    for (const detail of result.details) {
      const eventId = detail.eventId?.padEnd(15) || "unknown".padEnd(15);

      switch (detail.status) {
        case "updated":
          console.log(
            `[ZygoSync] ✓ ${eventId} - Updated (Item: ${detail.mondayItemId})`
          );
          break;
        case "skipped":
          console.log(`[ZygoSync] ⚠ ${eventId} - Skipped: ${detail.message}`);
          break;
        case "error":
          console.log(`[ZygoSync] ✗ ${eventId} - Error: ${detail.message}`);
          break;
      }
    }

    // ========================================
    // Phase 7: Log Summary
    // ========================================
    console.log("");
    console.log("─".repeat(60));
    console.log("[ZygoSync] Summary:");
    console.log(`  Total Processed:     ${result.totalProcessed}`);
    console.log(`  Successful Updates:  ${result.successfulUpdates}`);
    console.log(`  Skipped:             ${result.skipped}`);
    console.log(`  Errors:              ${result.errors}`);
    console.log("─".repeat(60));
    console.log("");

    // ========================================
    // Phase 8: Sync to Google Sheets
    // ========================================
    console.log("[ZygoSync] Phase 8: Starting sync to Google Sheets...");
    try {
      const sheetsService = GoogleSheetsService.getInstance();
      const sheetsResult = await sheetsService.syncActiveEvents(
        activeEvents,
        syncTimestamp,
        "ZY-"
      );

      console.log("[ZygoSync] Google Sheets Sync Summary:");
      console.log(`  Successful Updates:  ${sheetsResult.successfulUpdates}`);
      console.log(`  Skipped:             ${sheetsResult.skipped}`);
      console.log(`  Errors:              ${sheetsResult.errors}`);
      console.log("─".repeat(60));
      console.log("");
    } catch (sheetsError) {
      console.error("[ZygoSync] Google Sheets sync failed:", sheetsError);
    }

    // ========================================
    // Phase 9: Exit with Appropriate Code
    // ========================================
    if (result.errors === result.totalProcessed && result.totalProcessed > 0) {
      console.log("[ZygoSync] All events failed. Exiting with error code.");
      process.exit(1);
    } else {
      console.log("[ZygoSync] Parse and sync completed successfully.");
      process.exit(0);
    }
  } catch (error) {
    console.error("[ZygoSync] Fatal error:");

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

    // Проверка на ошибку невалидного токена
    const isTokenError = errorObj.message.includes('Refresh токен невалиден') ||
                         errorObj.message.includes('Требуется авторизация');

    if (isTokenError) {
      // При ошибке токена - выходим молча без отправки уведомления
      console.log("[ZygoSync] ⚠️  Token authentication failed. Exiting silently.");
      console.log("[ZygoSync] ℹ️  Please re-authorize via /zygo_auth command.");
      process.exit(0);
    }

    // Send notification to all Telegram users (только для не-токен ошибок)
    try {
      console.log(
        "[ZygoSync] Sending error notification to Telegram users..."
      );
      const notificationService = TelegramNotificationService.getInstance();
      const formattedMessage = notificationService.formatErrorMessage(
        errorObj,
        "Zygo Parse and Sync Script"
      );

      const notifyResult = await notificationService.broadcastToAllUsers(
        formattedMessage
      );
      console.log(
        `[ZygoSync] Notification sent: ${notifyResult.sent} successful, ${notifyResult.failed} failed`
      );

      if (notifyResult.failed > 0) {
        const failedUsers = notifyResult.details
          .filter((d) => !d.success)
          .map((d) => `User ${d.userId}: ${d.error}`)
          .join("\n  ");
        console.error(`[ZygoSync] Failed notifications:\n  ${failedUsers}`);
      }
    } catch (notificationError) {
      // Don't let notification errors crash the script
      console.error(
        "[ZygoSync] Failed to send Telegram notification:",
        notificationError
      );
    }

    process.exit(1);
  }
}

// Run main function
main();
