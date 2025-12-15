import { Bot, Context, InlineKeyboard } from "grammy";
import dotenv from "dotenv";
import { AuthService } from "./services/auth.service";
import { ChatIdTrackerService } from "./services/chat-id-tracker.service";
import { BotConfig } from "./types/bot.types";
import { executeParse } from "../core/scraper";
import { EventimScraper } from "../core/eventim-scraper";
import { GoShowScraper } from "../core/goshow-scraper";
import ZygoScraper from "../core/zygo-scraper";
import { Event } from "../core/types";
import MondayService from "../api/services/monday.service";
import ZygoTokenService from "../services/zygo-token.service";
import axios from "axios";

dotenv.config();

export class TelegramBotService {
  private bot: Bot<Context>;
  private authService: AuthService;
  private chatIdTracker: ChatIdTrackerService;
  private config: BotConfig;
  private awaitingZygoCode: Map<number, boolean> = new Map();
  private zygoVerifyTokens: Map<number, string> = new Map();

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN not found in .env file");
    }

    const allowedUserIds = process.env.TELEGRAM_ALLOWED_USER_IDS
      ? process.env.TELEGRAM_ALLOWED_USER_IDS.split(",").map((id) =>
          parseInt(id.trim(), 10)
        )
      : [];

    this.config = {
      token,
      allowedUserIds,
    };

    this.authService = new AuthService(allowedUserIds);
    this.chatIdTracker = ChatIdTrackerService.getInstance();
    this.bot = new Bot<Context>(token);

    this.setupBotMenu();
    this.setupCommands();
    this.setupMessageHandler();
    this.setupErrorHandler();
  }

  private async setupBotMenu(): Promise<void> {
    try {
      // Set bot commands for quick menu
      await this.bot.api.setMyCommands([
        { command: "help", description: "📖 Command list" },
        { command: "parseandsync", description: "🔄 Parse and sync" },
        { command: "events", description: "📅 Events list" },
        { command: "status", description: "✅ Bot status" },
        { command: "myid", description: "🆔 Get your ID" },
        { command: "zygo_auth", description: "🏆 Zygo authorization" },
      ]);
      console.log("✅ Bot menu commands set successfully");
    } catch (error) {
      console.error("❌ Failed to set bot menu commands:", error);
    }
  }

  private isUserAllowed(userId: number): boolean {
    return this.authService.isUserAllowed(userId);
  }

  private trackUserInteraction(
    userId: number,
    chatId: number,
    username?: string,
    firstName?: string
  ): void {
    if (this.isUserAllowed(userId)) {
      this.chatIdTracker.trackChatId(userId, chatId, username, firstName);
    }
  }

  private setupCommands(): void {
    // /start command
    this.bot.command("start", async (ctx) => {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "user";

      if (!userId || !chatId) {
        return;
      }

      // Track chat ID
      this.trackUserInteraction(
        userId,
        chatId,
        ctx.from?.username,
        ctx.from?.first_name
      );

      if (!this.isUserAllowed(userId)) {
        await ctx.reply(
          `❌ Sorry, you don't have access to this bot.\n\nYour ID: ${userId}\nSend this ID to administrator to get access.`
        );
        console.log(
          `Access attempt from unauthorized user: ${username} (ID: ${userId})`
        );
        return;
      }

      await ctx.reply(
        `👋 Hello, ${username}!\n\nWelcome to the events management bot.\n\nAvailable commands:\n/help - Command list\n/parseandsync - Parse and sync\n/events - Events list\n/status - Bot status\n/myid - Get your ID`
      );
    });

    // /help command
    this.bot.command("help", async (ctx) => {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;

      if (!userId || !chatId) {
        return;
      }

      // Track chat ID
      this.trackUserInteraction(
        userId,
        chatId,
        ctx.from?.username,
        ctx.from?.first_name
      );

      if (!this.isUserAllowed(userId)) {
        await this.sendAccessDeniedMessage(chatId, userId);
        return;
      }

      await ctx.reply(
        `📖 *Available Commands*\n\n` +
          `*General:*\n` +
          `/help - Show this help message\n` +
          `/status - Check bot status\n` +
          `/myid - Get your Telegram ID and token\n\n` +
          `*Event Management:*\n` +
          `/parseandsync - Parse and sync events with Monday.com\n` +
          `  • Ozen - Parse Ozen events\n` +
          `  • GoShow - Parse GoShow events\n` +
          `  • Zygo - Parse Zygo events\n` +
          `/events - View events list from Monday.com\n\n` +
          `*Authorization:*\n` +
          `/zygo_auth - Authorize Zygo account via SMS code\n\n` +
          `📎 *Eventim Reports:*\n` +
          `You can send Eventim report links directly:\n` +
          `https://webreporting.eventim.de/webreporting/public/Reports/STR\\_\\*.html\n` +
          `The bot will automatically parse and sync the data.`,
        { parse_mode: "Markdown" }
      );
    });

    // /status command
    this.bot.command("status", async (ctx) => {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;

      if (!userId || !chatId) {
        return;
      }

      // Track chat ID
      this.trackUserInteraction(
        userId,
        chatId,
        ctx.from?.username,
        ctx.from?.first_name
      );

      if (!this.isUserAllowed(userId)) {
        await this.sendAccessDeniedMessage(chatId, userId);
        return;
      }

      await ctx.reply(
        `✅ Bot is working normally\n\n👥 Authorized users: ${
          this.authService.getAllowedUsers().length
        }`
      );
    });

    // /myid command
    this.bot.command("myid", async (ctx) => {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username;
      const firstName = ctx.from?.first_name;

      if (!userId || !chatId) {
        return;
      }

      // Track chat ID
      this.trackUserInteraction(userId, chatId, username, firstName);

      const isAllowed = this.isUserAllowed(userId);

      // Get or create token
      const token = this.chatIdTracker.getOrCreateToken(userId);

      // Format message
      let message = `👤 Your information:\n\n`;
      message += `• Telegram ID: ${userId}\n`;

      if (username) {
        message += `• Username: @${username}\n`;
      }

      if (token) {
        message += `• Token: \`${token}\`\n`;
      } else {
        message += `• Token: not available\n`;
      }

      message += `• Status: ${
        isAllowed ? "✅ Authorized" : "❌ Not authorized"
      }`;

      await ctx.reply(message, { parse_mode: "Markdown" });
    });

    // /parseandsync command
    this.bot.command("parseandsync", async (ctx) => {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;

      if (!userId || !chatId) {
        return;
      }

      // Track chat ID
      this.trackUserInteraction(
        userId,
        chatId,
        ctx.from?.username,
        ctx.from?.first_name
      );

      if (!this.isUserAllowed(userId)) {
        await this.sendAccessDeniedMessage(chatId, userId);
        return;
      }

      // Show source selection menu with InlineKeyboard
      const keyboard = new InlineKeyboard()
        .text("🎭 Ozen", "parse_ozen")
        .row()
        .text("🎪 GoShow", "parse_goshow")
        .row()
        .text("🏆 Zygo", "parse_zygo");

      await ctx.reply("📋 Select parsing source:", {
        reply_markup: keyboard,
      });
    });

    // /zygo_auth command
    this.bot.command("zygo_auth", async (ctx) => {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;

      if (!userId || !chatId) {
        return;
      }

      // Track chat ID
      this.trackUserInteraction(
        userId,
        chatId,
        ctx.from?.username,
        ctx.from?.first_name
      );

      try {
        const phone = process.env.ZYGO_USERPHONE;
        if (!phone) {
          await ctx.reply("❌ ZYGO_USERPHONE is not set in .env file");
          return;
        }

        await ctx.reply("🔄 Sending code to phone...");

        // Send code via Zygo API v2
        const response = await axios.post(
          "https://api.zygo.co.il/v2/auth/create-verify-token",
          { phone },
          {
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              Origin: "https://zygo.co.il",
              Referer: "https://zygo.co.il/",
            },
          }
        );

        // Save verify token
        if (response.data?.token) {
          this.zygoVerifyTokens.set(userId, response.data.token);
        }

        // Set flag to wait for code
        this.awaitingZygoCode.set(userId, true);

        await ctx.reply(
          `📱 Code sent to phone ${phone}\n\n` +
            `Enter the 6-digit code from SMS:`
        );
      } catch (error: any) {
        console.error("Error sending Zygo auth code:", error);
        await ctx.reply(
          `❌ Error sending code: ${
            error.response?.data?.message || error.message
          }`
        );
      }
    });

    // /events command
    this.bot.command("events", async (ctx) => {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;

      if (!userId || !chatId) {
        return;
      }

      // Track chat ID
      this.trackUserInteraction(
        userId,
        chatId,
        ctx.from?.username,
        ctx.from?.first_name
      );

      if (!this.isUserAllowed(userId)) {
        await this.sendAccessDeniedMessage(chatId, userId);
        return;
      }

      await ctx.reply("📋 Getting events list from Monday.com...");

      try {
        const mondayService = MondayService.getInstance();
        const items = await mondayService.getAllItems(50);

        if (items.length === 0) {
          await ctx.reply("⚠️ No events found in Monday.com");
          return;
        }

        // Format the events list as a table
        let message = `📅 *Events in Monday.com* (${items.length} total)\n\n`;
        message += "```\n";
        message +=
          "№  | Event Name         | Event ID    | Sold/Cap | Updated\n";
        message +=
          "---|--------------------|-----------  |----------|-------------------\n";

        items.forEach((item, index) => {
          // Find Event ID column
          const eventIdCol = item.column_values.find(
            (col) =>
              col.id === process.env.MONDAY_COM_EVENT_ID_COLUMN ||
              col.id === "text_mkxy6ra8"
          );

          // Find Tickets Sold column
          const ticketsSoldCol = item.column_values.find(
            (col) =>
              col.id === process.env.MONDAY_COM_TICKETS_SOLD_COLUMN ||
              col.id === "numeric_mkxsf3c8"
          );

          // Find Capacity column
          const capacityCol = item.column_values.find(
            (col) =>
              col.id === process.env.MONDAY_COM_CAPACITY_COLUMN ||
              col.id === "numeric_mkxst6mx"
          );

          // Find Update Date column
          const updateDateCol = item.column_values.find(
            (col) =>
              col.id === process.env.MONDAY_COM_UPDATE_DATE_COLUMN ||
              col.id === "date_mky2adca"
          );

          const eventId = eventIdCol?.text || "N/A";
          const ticketsSold = ticketsSoldCol?.text || "0";
          const capacity = capacityCol?.text || "0";

          // Parse Update Date from value JSON (date + time are in UTC)
          let formattedDateTime = "N/A";
          if (updateDateCol?.value) {
            try {
              const parsed = JSON.parse(updateDateCol.value);
              if (parsed.date && parsed.time) {
                // Combine date and time as UTC (add Z suffix)
                const isoString = `${parsed.date}T${parsed.time}Z`;
                const dateTime = new Date(isoString);

                // Convert to Jerusalem timezone
                const formatter = new Intl.DateTimeFormat("en-GB", {
                  timeZone: "Asia/Jerusalem",
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                });

                const parts = formatter.formatToParts(dateTime);
                const day = parts.find((p) => p.type === "day")?.value || "00";
                const month =
                  parts.find((p) => p.type === "month")?.value || "00";
                const hour =
                  parts.find((p) => p.type === "hour")?.value || "00";
                const minute =
                  parts.find((p) => p.type === "minute")?.value || "00";

                formattedDateTime = `${day}.${month} ${hour}:${minute} IL`;
              }
            } catch (e) {
              // If parsing fails, fallback to N/A
              formattedDateTime = "N/A";
            }
          }

          // Truncate name if too long
          const name =
            item.name.length > 18
              ? item.name.substring(0, 15) + "..."
              : item.name;

          // Format row with padding
          const num = String(index + 1).padStart(2, " ");
          const namePad = name.padEnd(18, " ");
          const idPad = eventId.padEnd(11, " ");
          const tickets = `${ticketsSold}/${capacity}`.padEnd(8, " ");
          const datePad = formattedDateTime.padEnd(17, " ");

          message += `${num} | ${namePad} | ${idPad} | ${tickets} | ${datePad}\n`;

          // Telegram has a message length limit, split if needed
          if (message.length > 3500) {
            message += "```";
            this.bot.api.sendMessage(chatId, message, {
              parse_mode: "Markdown",
            });
            message = "```\n";
          }
        });

        message += "```";

        if (message.length > 0) {
          await this.bot.api.sendMessage(chatId, message, {
            parse_mode: "Markdown",
          });
        }
      } catch (error) {
        console.error("Error getting events:", error);
        await ctx.reply(`❌ Error getting events: ${(error as Error).message}`);
      }
    });

    // Handle callback queries for parse source selection
    this.bot.callbackQuery(/^parse_/, async (ctx) => {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const data = ctx.callbackQuery.data;

      if (!chatId || !data) {
        return;
      }

      // Answer callback to remove loading state
      await ctx.answerCallbackQuery();

      // Check authorization
      if (!userId || !this.isUserAllowed(userId)) {
        await ctx.answerCallbackQuery({
          text: "❌ Access denied",
          show_alert: true,
        });
        return;
      }

      // Update the message to show selected option
      const sourceNames: Record<string, string> = {
        parse_ozen: "🎭 Ozen",
        parse_goshow: "🎪 GoShow",
        parse_eventim: "🎫 Eventim",
        parse_zygo: "🏆 Zygo",
        parse_both: "🔄 Both sources",
      };

      await ctx.editMessageText(
        `📋 Selected: ${sourceNames[data] || data}\n\n🔄 Starting...`
      );

      try {
        if (data === "parse_ozen") {
          await this.executeOzenParseAndSync(chatId);
        } else if (data === "parse_goshow") {
          await this.executeGoShowParseAndSync(chatId);
        } else if (data === "parse_eventim") {
          await this.executeEventimParseAndSync(chatId);
        } else if (data === "parse_zygo") {
          await this.executeZygoParseAndSync(chatId);
        } else if (data === "parse_both") {
          await this.executeOzenParseAndSync(chatId);
          await this.executeEventimParseAndSync(chatId);
        }
      } catch (error) {
        console.error("Error during parsing and synchronization:", error);
        await this.bot.api.sendMessage(
          chatId,
          `❌ Error: ${(error as Error).message}`
        );
      }
    });
  }

  private setupMessageHandler(): void {
    this.bot.on("message:text", async (ctx) => {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const text = ctx.message.text;

      if (!userId || !chatId) {
        return;
      }

      // Track chat ID for any message
      this.trackUserInteraction(
        userId,
        chatId,
        ctx.from?.username,
        ctx.from?.first_name
      );

      // Check if waiting for Zygo code
      if (
        this.awaitingZygoCode.get(userId) &&
        text &&
        !text.startsWith("/")
      ) {
        await this.handleZygoCodeInput(userId, chatId, text);
        return;
      }

      // Check if message contains Eventim report URL
      const eventimUrlPattern =
        /https:\/\/webreporting\.eventim\.de\/webreporting\/public\/Reports\/STR_[\w-]+\.html/;
      const match = text.match(eventimUrlPattern);

      if (match && this.isUserAllowed(userId)) {
        const url = match[0];
        await this.handleEventimStaticReport(chatId, url);
        return;
      }

      // If message is not a command and user is not authorized
      if (!text.startsWith("/") && !this.isUserAllowed(userId)) {
        await this.sendAccessDeniedMessage(chatId, userId);
      }
    });
  }

  private setupErrorHandler(): void {
    this.bot.catch((err) => {
      console.error(`Error while handling update ${err.ctx.update.update_id}:`);
      console.error(err.error);
    });
  }

  /**
   * Handle Zygo code input from user
   */
  private async handleZygoCodeInput(
    userId: number,
    chatId: number,
    code: string
  ): Promise<void> {
    // Check code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      await this.bot.api.sendMessage(
        chatId,
        "❌ Invalid code format. Enter the 6-digit code from SMS:"
      );
      return;
    }

    try {
      await this.bot.api.sendMessage(chatId, "🔄 Checking code...");

      const phone = process.env.ZYGO_USERPHONE;
      if (!phone) {
        throw new Error("ZYGO_USERPHONE is not set");
      }

      // Get verify token
      const verifyToken = this.zygoVerifyTokens.get(userId);
      if (!verifyToken) {
        throw new Error("Verify token not found. Try /zygo_auth again.");
      }

      // Verify code via Zygo API v2
      const response = await axios.post<any>(
        "https://api.zygo.co.il/v2/auth/verify-phone-code-register-check-if-user",
        {
          phone,
          code,
          token: verifyToken,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Origin: "https://zygo.co.il",
            Referer: "https://zygo.co.il/",
          },
        }
      );

      // Check that user exists and has tokens
      if (!response.data.ok || !response.data.exists || !response.data.tokens) {
        throw new Error(
          "User not found or not authorized. Please register on zygo.co.il first."
        );
      }

      // Save tokens via ZygoTokenService
      const tokenService = ZygoTokenService.getInstance();
      tokenService.setTokens({
        user: response.data.user,
        tokens: {
          access: {
            token: response.data.tokens.access.token,
            expires: response.data.tokens.access.expires,
          },
          refresh: {
            token: response.data.tokens.refresh.token,
            expires: response.data.tokens.refresh.expires,
          },
        },
      });

      // Remove waiting flags
      this.awaitingZygoCode.delete(userId);
      this.zygoVerifyTokens.delete(userId);

      await this.bot.api.sendMessage(
        chatId,
        `✅ Authorization successful!\n\n` +
          `User: ${response.data.user.firstName || ""} ${
            response.data.user.lastName || ""
          }\n` +
          `Token saved and will be refreshed automatically.`
      );
    } catch (error: any) {
      console.error("Error verifying Zygo code:", error);

      // Remove waiting flags on error
      this.awaitingZygoCode.delete(userId);
      this.zygoVerifyTokens.delete(userId);

      await this.bot.api.sendMessage(
        chatId,
        `❌ Code verification error: ${
          error.response?.data?.message || error.message
        }\n\n` + `Try again using /zygo_auth`
      );
    }
  }

  /**
   * Format sync details to show errors and skipped items
   */
  private formatSyncDetails(
    details: Array<{
      eventId?: string;
      status: string;
      message?: string;
      mondayItemId?: string;
    }>
  ): string | null {
    const errors = details.filter((d) => d.status === "error");
    const skipped = details.filter((d) => d.status === "skipped");

    if (errors.length === 0 && skipped.length === 0) {
      return null;
    }

    const parts: string[] = [];

    if (errors.length > 0) {
      parts.push("❌ Errors:");
      errors.forEach((detail) => {
        const eventId = detail.eventId || "unknown";
        const message = detail.message || "Unknown error";
        parts.push(`  • ${eventId}: ${message}`);
      });
    }

    if (skipped.length > 0) {
      parts.push("\n⚠️ Skipped:");
      skipped.forEach((detail) => {
        const eventId = detail.eventId || "unknown";
        const message = detail.message || "No reason provided";
        parts.push(`  • ${eventId}: ${message}`);
      });
    }

    return parts.join("\n");
  }

  private async executeOzenParseAndSync(chatId: number): Promise<void> {
    await this.bot.api.sendMessage(
      chatId,
      "🎭 [Ozen] Starting parsing...\n\nThis may take some time."
    );

    const parseResult = await executeParse({
      headless: true,
      closeAfter: true,
    });

    await this.bot.api.sendMessage(
      chatId,
      `✅ [Ozen] Parsing completed!\n\n📊 Total events: ${parseResult.events.length}\n📁 File: ${parseResult.outputFile}`
    );

    const activeEvents = parseResult.events.filter((e) => e.active === true);
    await this.bot.api.sendMessage(
      chatId,
      `🔍 [Ozen] Active events found: ${activeEvents.length} of ${parseResult.events.length}`
    );

    if (activeEvents.length === 0) {
      await this.bot.api.sendMessage(chatId, "⚠️ [Ozen] No active events to sync");
      return;
    }

    await this.bot.api.sendMessage(
      chatId,
      "🔄 [Ozen] Starting sync with Monday.com..."
    );

    const mondayService = MondayService.getInstance();
    const syncTimestamp = new Date();
    const syncResults = await mondayService.syncActiveEvents(
      activeEvents,
      syncTimestamp,
      "OZ-"
    );

    const summary = [
      "✅ [Ozen] Sync completed!\n",
      `📊 Results:`,
      `• Processed: ${syncResults.totalProcessed}`,
      `• Successfully updated: ${syncResults.successfulUpdates}`,
      `• Skipped: ${syncResults.skipped}`,
      `• Errors: ${syncResults.errors}`,
      `\n⏰ Time: ${new Date().toISOString()}`,
    ].join("\n");

    await this.bot.api.sendMessage(chatId, summary);

    // Send detailed errors and skipped items if any
    const details = this.formatSyncDetails(syncResults.details);
    if (details) {
      await this.bot.api.sendMessage(chatId, details);
    }
  }

  private async executeGoShowParseAndSync(chatId: number): Promise<void> {
    await this.bot.api.sendMessage(
      chatId,
      "🎪 [GoShow] Starting parsing...\n\nThis may take some time."
    );

    const scraper = new GoShowScraper({
      headless: true,
      closeAfter: true,
    });

    const parseResult = await scraper.execute();

    await this.bot.api.sendMessage(
      chatId,
      `✅ [GoShow] Parsing completed!\n\n📊 Total events: ${parseResult.events.length}\n📁 File: ${parseResult.outputFile}`
    );

    // Convert GoShowEvent[] to Event[] (all GoShow events are active)
    const activeEvents: Event[] = parseResult.events.map((e) => ({
      active: true,
      eventId: e.eventId,
      ticketsSold: {
        total: e.ticketsSold.total,
        capacity: e.ticketsSold.capacity,
      },
    }));

    await this.bot.api.sendMessage(
      chatId,
      `🔍 [GoShow] Active events: ${activeEvents.length}`
    );

    if (activeEvents.length === 0) {
      await this.bot.api.sendMessage(chatId, "⚠️ [GoShow] No events to sync");
      return;
    }

    await this.bot.api.sendMessage(
      chatId,
      "🔄 [GoShow] Starting sync with Monday.com..."
    );

    const mondayService = MondayService.getInstance();
    const syncTimestamp = new Date();
    const syncResults = await mondayService.syncActiveEvents(
      activeEvents,
      syncTimestamp,
      "GO-"
    );

    const summary = [
      "✅ [GoShow] Sync completed!\n",
      `📊 Results:`,
      `• Processed: ${syncResults.totalProcessed}`,
      `• Successfully updated: ${syncResults.successfulUpdates}`,
      `• Skipped: ${syncResults.skipped}`,
      `• Errors: ${syncResults.errors}`,
      `\n⏰ Time: ${new Date().toISOString()}`,
    ].join("\n");

    await this.bot.api.sendMessage(chatId, summary);

    // Send detailed errors and skipped items if any
    const details = this.formatSyncDetails(syncResults.details);
    if (details) {
      await this.bot.api.sendMessage(chatId, details);
    }
  }

  private async executeZygoParseAndSync(chatId: number): Promise<void> {
    // Check token status before starting parsing
    const tokenService = ZygoTokenService.getInstance();
    const tokenStatus = tokenService.getTokenStatus();

    if (!tokenStatus.hasTokens) {
      await this.bot.api.sendMessage(
        chatId,
        '❌ [Zygo] Tokens are missing. Execute /zygo_auth to authorize.'
      );
      return;
    }

    if (tokenStatus.isRefreshTokenInvalid) {
      await this.bot.api.sendMessage(
        chatId,
        '❌ [Zygo] Refresh token is invalid. ' +
        'Re-authorization is required via /zygo_auth'
      );
      return;
    }

    await this.bot.api.sendMessage(
      chatId,
      "🏆 [Zygo] Starting parsing...\n\nThis may take some time."
    );

    try {
      const scraper = new ZygoScraper();
      const events = await scraper.getManagedEvents(false); // past=false for future events

      await this.bot.api.sendMessage(
        chatId,
        `✅ [Zygo] Parsing completed!\n\n📊 Total managed events: ${events.length}`
      );

      if (events.length === 0) {
        await this.bot.api.sendMessage(chatId, "⚠️ [Zygo] No managed events found");
        return;
      }

      // Filter only future events
      const now = new Date();
      const upcomingEvents = events.filter((e) => new Date(e.startDate) > now);

      // Convert to Event format for Monday.com
      const activeEvents: Event[] = upcomingEvents.map((e) => ({
        active: true,
        eventId: e.identifier,
        ticketsSold: {
          total: e.analytics?.approved || 0, // Use actual number of sold tickets
          // capacity is NOT passed - filled in Monday.com manually
        },
      }));

      await this.bot.api.sendMessage(
        chatId,
        `🔍 [Zygo] Upcoming events: ${activeEvents.length} of ${events.length}`
      );

      if (activeEvents.length === 0) {
        await this.bot.api.sendMessage(
          chatId,
          "⚠️ [Zygo] No upcoming events to sync"
        );
        return;
      }

      await this.bot.api.sendMessage(
        chatId,
        "🔄 [Zygo] Starting sync with Monday.com..."
      );

      const mondayService = MondayService.getInstance();
      const syncTimestamp = new Date();
      const syncResults = await mondayService.syncActiveEvents(
        activeEvents,
        syncTimestamp,
        "ZY-"
      );

      const summary = [
        "✅ [Zygo] Sync completed!\n",
        `📊 Results:`,
        `• Processed: ${syncResults.totalProcessed}`,
        `• Successfully updated: ${syncResults.successfulUpdates}`,
        `• Skipped: ${syncResults.skipped}`,
        `• Errors: ${syncResults.errors}`,
        `\n⏰ Time: ${new Date().toISOString()}`,
      ].join("\n");

      await this.bot.api.sendMessage(chatId, summary);

      // Send detailed errors and skipped items if any
      const details = this.formatSyncDetails(syncResults.details);
      if (details) {
        await this.bot.api.sendMessage(chatId, details);
      }
    } catch (error: any) {
      console.error("Error in Zygo parse and sync:", error);
      await this.bot.api.sendMessage(chatId, `❌ [Zygo] Error: ${error.message}`);
    }
  }

  private async executeEventimParseAndSync(chatId: number): Promise<void> {
    await this.bot.api.sendMessage(
      chatId,
      "🎫 [Eventim] Starting parsing...\n\nThis may take some time."
    );

    const scraper = new EventimScraper({
      headless: true,
      closeAfter: true,
    });

    const parseResult = await scraper.execute();

    await this.bot.api.sendMessage(
      chatId,
      `✅ [Eventim] Parsing completed!\n\n📊 Total events: ${parseResult.events.length}\n📁 File: ${parseResult.outputFile}`
    );

    // Convert EventimEvent[] to Event[] (all Eventim events are active)
    const activeEvents: Event[] = parseResult.events.map((e) => ({
      active: true,
      eventId: e.eventId,
      ticketsSold: {
        total: e.ticketsSold.total,
        capacity: e.ticketsSold.capacity,
      },
    }));

    await this.bot.api.sendMessage(
      chatId,
      `🔍 [Eventim] Active events: ${activeEvents.length}`
    );

    if (activeEvents.length === 0) {
      await this.bot.api.sendMessage(chatId, "⚠️ [Eventim] No events to sync");
      return;
    }

    await this.bot.api.sendMessage(
      chatId,
      "🔄 [Eventim] Starting sync with Monday.com..."
    );

    const mondayService = MondayService.getInstance();
    const syncTimestamp = new Date();
    const syncResults = await mondayService.syncActiveEvents(
      activeEvents,
      syncTimestamp,
      "ZAP-"
    );

    const summary = [
      "✅ [Eventim] Sync completed!\n",
      `📊 Results:`,
      `• Processed: ${syncResults.totalProcessed}`,
      `• Successfully updated: ${syncResults.successfulUpdates}`,
      `• Skipped: ${syncResults.skipped}`,
      `• Errors: ${syncResults.errors}`,
      `\n⏰ Time: ${new Date().toISOString()}`,
    ].join("\n");

    await this.bot.api.sendMessage(chatId, summary);

    // Send detailed errors and skipped items if any
    const details = this.formatSyncDetails(syncResults.details);
    if (details) {
      await this.bot.api.sendMessage(chatId, details);
    }
  }

  private async handleEventimStaticReport(
    chatId: number,
    url: string
  ): Promise<void> {
    await this.bot.api.sendMessage(
      chatId,
      `🎫 [Eventim] Processing static HTML report...\n\n📄 URL: ${url}`
    );

    try {
      // Parse the static HTML report with freshness check
      const checkResult = await EventimScraper.parseFromUrlWithCheck(url);

      // If skipped, the report was too old
      if (checkResult.skipped) {
        let skipMessage = `⏭️ [Eventim] Report skipped - not newer than the last processed report.`;

        if (checkResult.currentPrintTime) {
          skipMessage += `\n\n📄 Current report time: ${checkResult.currentPrintTime}`;
        }

        if (checkResult.lastPrintTime) {
          skipMessage += `\n📅 Last processed report: ${checkResult.lastPrintTime}`;
        }

        skipMessage += `\n\nPlease send a more recent report.`;

        await this.bot.api.sendMessage(chatId, skipMessage);
        return;
      }

      const parseResult = checkResult.result;
      if (!parseResult) {
        throw new Error("Unexpected: result is null but not skipped");
      }

      let statusMessage = `✅ [Eventim] Parsing completed!\n\n📊 Total events: ${parseResult.events.length}\n📁 File: ${parseResult.outputFile}`;

      if (parseResult.printTime) {
        statusMessage += `\n📅 Report time: ${parseResult.printTime}`;
      }

      await this.bot.api.sendMessage(chatId, statusMessage);

      // Convert EventimEvent[] to Event[] (all Eventim events are active)
      const activeEvents: Event[] = parseResult.events.map((e) => ({
        active: true,
        eventId: e.eventId,
        ticketsSold: {
          total: e.ticketsSold.total,
          capacity: e.ticketsSold.capacity,
        },
      }));

      if (activeEvents.length === 0) {
        await this.bot.api.sendMessage(chatId, "⚠️ [Eventim] No events found");
        return;
      }

      await this.bot.api.sendMessage(
        chatId,
        "🔄 [Eventim] Starting sync with Monday.com..."
      );

      const mondayService = MondayService.getInstance();
      const syncTimestamp = new Date();
      const syncResults = await mondayService.syncActiveEvents(
        activeEvents,
        syncTimestamp,
        "ZAP-"
      );

      const summary = [
        "✅ [Eventim] Sync completed!\n",
        `📊 Results:`,
        `• Processed: ${syncResults.totalProcessed}`,
        `• Successfully updated: ${syncResults.successfulUpdates}`,
        `• Skipped: ${syncResults.skipped}`,
        `• Errors: ${syncResults.errors}`,
        `\n⏰ Time: ${new Date().toISOString()}`,
      ].join("\n");

      await this.bot.api.sendMessage(chatId, summary);

      // Send detailed errors and skipped items if any
      const details = this.formatSyncDetails(syncResults.details);
      if (details) {
        await this.bot.api.sendMessage(chatId, details);
      }
    } catch (error) {
      console.error("Error processing Eventim static report:", error);
      await this.bot.api.sendMessage(
        chatId,
        `❌ [Eventim] Error: ${(error as Error).message}`
      );
    }
  }

  private async sendAccessDeniedMessage(chatId: number, userId?: number): Promise<void> {
    await this.bot.api.sendMessage(
      chatId,
      `❌ Access denied.\n\n${
        userId ? `Your ID: ${userId}\n` : ""
      }Send your ID to administrator to get access.`
    );
  }

  public async start(): Promise<void> {
    console.log("🤖 Telegram bot started");
    console.log(
      `👥 Authorized users: ${this.authService.getAllowedUsers().length}`
    );
    console.log(`📋 ID list: ${this.authService.getAllowedUsers().join(", ")}`);

    await this.bot.start();
  }

  public async stop(): Promise<void> {
    await this.bot.stop();
    console.log("🛑 Telegram bot stopped");
  }
}

// Start bot if file is run directly
if (require.main === module) {
  const bot = new TelegramBotService();

  bot.start().catch(console.error);

  process.on("SIGINT", async () => {
    console.log("\n👋 Received SIGINT signal, stopping bot...");
    await bot.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n👋 Received SIGTERM signal, stopping bot...");
    await bot.stop();
    process.exit(0);
  });
}
