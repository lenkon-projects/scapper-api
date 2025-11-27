import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { AuthService } from "./services/auth.service";
import { ChatIdTrackerService } from "./services/chat-id-tracker.service";
import { BotConfig } from "./types/bot.types";
import { executeParse } from "../core/scraper";
import { EventimScraper } from "../core/eventim-scraper";
import { Event } from "../core/types";
import MondayService from "../api/services/monday.service";

dotenv.config();

export class TelegramBotService {
  private bot: TelegramBot;
  private authService: AuthService;
  private chatIdTracker: ChatIdTrackerService;
  private config: BotConfig;

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
    this.bot = new TelegramBot(token, { polling: true });

    this.setupCommands();
    this.setupMessageHandler();
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
    this.bot.onText(/\/start/, (msg) => {
      const userId = msg.from?.id;
      const username = msg.from?.username || msg.from?.first_name || "user";

      if (!userId) {
        return;
      }

      // Track chat ID
      this.trackUserInteraction(
        userId,
        msg.chat.id,
        msg.from?.username,
        msg.from?.first_name
      );

      if (!this.isUserAllowed(userId)) {
        this.bot.sendMessage(
          msg.chat.id,
          `❌ Sorry, you don't have access to this bot.\n\nYour ID: ${userId}\nSend this ID to administrator to get access.`
        );
        console.log(
          `Access attempt from unauthorized user: ${username} (ID: ${userId})`
        );
        return;
      }

      this.bot.sendMessage(
        msg.chat.id,
        `👋 Hello, ${username}!\n\nWelcome to the events management bot.\n\nAvailable commands:\n/help - Command list\n/parseandsync - Parse and sync\n/status - Bot status\n/myid - Get your ID`
      );
    });

    this.bot.onText(/\/help/, (msg) => {
      const userId = msg.from?.id;

      if (!userId) {
        return;
      }

      // Track chat ID
      this.trackUserInteraction(
        userId,
        msg.chat.id,
        msg.from?.username,
        msg.from?.first_name
      );

      if (!this.isUserAllowed(userId)) {
        this.sendAccessDeniedMessage(msg.chat.id, userId);
        return;
      }

      this.bot.sendMessage(
        msg.chat.id,
        `📖 Available commands:\n\n/start - Start working with the bot\n/help - Show this message\n/status - Check bot status\n/myid - Get your Telegram ID\n/parseandsync - Run parsing and synchronization with Monday.com\n/events - Get events list`
      );
    });

    this.bot.onText(/\/status/, (msg) => {
      const userId = msg.from?.id;

      if (!userId) {
        return;
      }

      // Track chat ID
      this.trackUserInteraction(
        userId,
        msg.chat.id,
        msg.from?.username,
        msg.from?.first_name
      );

      if (!this.isUserAllowed(userId)) {
        this.sendAccessDeniedMessage(msg.chat.id, userId);
        return;
      }

      this.bot.sendMessage(
        msg.chat.id,
        `✅ Bot is working normally\n\n👥 Authorized users: ${
          this.authService.getAllowedUsers().length
        }`
      );
    });

    this.bot.onText(/\/myid/, (msg) => {
      const userId = msg.from?.id;
      const username = msg.from?.username || msg.from?.first_name || "unknown";

      if (!userId) {
        return;
      }

      // Track chat ID
      this.trackUserInteraction(
        userId,
        msg.chat.id,
        msg.from?.username,
        msg.from?.first_name
      );

      const isAllowed = this.isUserAllowed(userId);
      this.bot.sendMessage(
        msg.chat.id,
        `🆔 Your Telegram ID: ${userId}\n👤 Username: ${username}\n${
          isAllowed ? "✅ Access granted" : "❌ Access denied"
        }`
      );
    });

    this.bot.onText(/\/parseandsync/, async (msg) => {
      const userId = msg.from?.id;
      const chatId = msg.chat.id;

      if (!userId) {
        return;
      }

      // Track chat ID
      this.trackUserInteraction(
        userId,
        chatId,
        msg.from?.username,
        msg.from?.first_name
      );

      if (!this.isUserAllowed(userId)) {
        this.sendAccessDeniedMessage(chatId, userId);
        return;
      }

      // Show source selection menu
      const opts: TelegramBot.SendMessageOptions = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎭 Ozen", callback_data: "parse_ozen" }],
            [{ text: "🎫 Eventim", callback_data: "parse_eventim" }],
            [{ text: "🔄 Оба источника", callback_data: "parse_both" }],
          ],
        },
      };

      await this.bot.sendMessage(
        chatId,
        "📋 Выберите источник для парсинга:",
        opts
      );
    });

    // Handle callback queries for parse source selection
    this.bot.on("callback_query", async (query) => {
      const userId = query.from.id;
      const chatId = query.message?.chat.id;
      const messageId = query.message?.message_id;
      const data = query.data;

      if (!chatId || !data?.startsWith("parse_")) {
        return;
      }

      // Answer callback to remove loading state
      await this.bot.answerCallbackQuery(query.id);

      // Check authorization
      if (!this.isUserAllowed(userId)) {
        await this.bot.answerCallbackQuery(query.id, {
          text: "❌ Доступ запрещён",
          show_alert: true,
        });
        return;
      }

      // Update the message to show selected option
      const sourceNames: Record<string, string> = {
        parse_ozen: "🎭 Ozen",
        parse_eventim: "🎫 Eventim",
        parse_both: "🔄 Оба источника",
      };

      if (messageId) {
        await this.bot.editMessageText(
          `📋 Выбрано: ${sourceNames[data] || data}\n\n🔄 Запуск...`,
          { chat_id: chatId, message_id: messageId }
        );
      }

      try {
        if (data === "parse_ozen") {
          await this.executeOzenParseAndSync(chatId);
        } else if (data === "parse_eventim") {
          await this.executeEventimParseAndSync(chatId);
        } else if (data === "parse_both") {
          await this.executeOzenParseAndSync(chatId);
          await this.executeEventimParseAndSync(chatId);
        }
      } catch (error) {
        console.error("Error during parsing and synchronization:", error);
        await this.bot.sendMessage(
          chatId,
          `❌ Ошибка: ${(error as Error).message}`
        );
      }
    });

    this.bot.onText(/\/events/, async (msg) => {
      const userId = msg.from?.id;

      if (!userId) {
        return;
      }

      // Track chat ID
      this.trackUserInteraction(
        userId,
        msg.chat.id,
        msg.from?.username,
        msg.from?.first_name
      );

      if (!this.isUserAllowed(userId)) {
        this.sendAccessDeniedMessage(msg.chat.id, userId);
        return;
      }

      this.bot.sendMessage(msg.chat.id, "📋 Getting events list...");

      // Here you can add logic for getting events
      // For example, call API endpoint to get events
    });
  }

  private setupMessageHandler(): void {
    this.bot.on("message", (msg) => {
      const userId = msg.from?.id;

      if (!userId) {
        return;
      }

      // Track chat ID for any message
      this.trackUserInteraction(
        userId,
        msg.chat.id,
        msg.from?.username,
        msg.from?.first_name
      );

      // If message is not a command and user is not authorized
      if (!msg.text?.startsWith("/") && !this.isUserAllowed(userId)) {
        this.sendAccessDeniedMessage(msg.chat.id, userId);
      }
    });
  }

  private async executeOzenParseAndSync(chatId: number): Promise<void> {
    await this.bot.sendMessage(
      chatId,
      "🎭 [Ozen] Начинаю парсинг...\n\nЭто может занять некоторое время."
    );

    const parseResult = await executeParse({
      headless: true,
      closeAfter: true,
    });

    await this.bot.sendMessage(
      chatId,
      `✅ [Ozen] Парсинг завершён!\n\n📊 Всего событий: ${parseResult.events.length}\n📁 Файл: ${parseResult.outputFile}`
    );

    const activeEvents = parseResult.events.filter((e) => e.active === true);
    await this.bot.sendMessage(
      chatId,
      `🔍 [Ozen] Найдено активных событий: ${activeEvents.length} из ${parseResult.events.length}`
    );

    if (activeEvents.length === 0) {
      await this.bot.sendMessage(
        chatId,
        "⚠️ [Ozen] Нет активных событий для синхронизации"
      );
      return;
    }

    await this.bot.sendMessage(
      chatId,
      "🔄 [Ozen] Начинаю синхронизацию с Monday.com..."
    );

    const mondayService = MondayService.getInstance();
    const syncTimestamp = new Date();
    const syncResults = await mondayService.syncActiveEvents(
      activeEvents,
      syncTimestamp,
      "OZ-"
    );

    const summary = [
      "✅ [Ozen] Синхронизация завершена!\n",
      `📊 Результаты:`,
      `• Обработано: ${syncResults.totalProcessed}`,
      `• Успешно обновлено: ${syncResults.successfulUpdates}`,
      `• Пропущено: ${syncResults.skipped}`,
      `• Ошибок: ${syncResults.errors}`,
      `\n⏰ Время: ${new Date().toLocaleString("ru-RU")}`,
    ].join("\n");

    await this.bot.sendMessage(chatId, summary);
  }

  private async executeEventimParseAndSync(chatId: number): Promise<void> {
    await this.bot.sendMessage(
      chatId,
      "🎫 [Eventim] Начинаю парсинг...\n\nЭто может занять некоторое время."
    );

    const scraper = new EventimScraper({
      headless: true,
      closeAfter: true,
    });

    const parseResult = await scraper.execute();

    await this.bot.sendMessage(
      chatId,
      `✅ [Eventim] Парсинг завершён!\n\n📊 Всего событий: ${parseResult.events.length}\n📁 Файл: ${parseResult.outputFile}`
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

    await this.bot.sendMessage(
      chatId,
      `🔍 [Eventim] Активных событий: ${activeEvents.length}`
    );

    if (activeEvents.length === 0) {
      await this.bot.sendMessage(
        chatId,
        "⚠️ [Eventim] Нет событий для синхронизации"
      );
      return;
    }

    await this.bot.sendMessage(
      chatId,
      "🔄 [Eventim] Начинаю синхронизацию с Monday.com..."
    );

    const mondayService = MondayService.getInstance();
    const syncTimestamp = new Date();
    const syncResults = await mondayService.syncActiveEvents(
      activeEvents,
      syncTimestamp,
      "ZAP-"
    );

    const summary = [
      "✅ [Eventim] Синхронизация завершена!\n",
      `📊 Результаты:`,
      `• Обработано: ${syncResults.totalProcessed}`,
      `• Успешно обновлено: ${syncResults.successfulUpdates}`,
      `• Пропущено: ${syncResults.skipped}`,
      `• Ошибок: ${syncResults.errors}`,
      `\n⏰ Время: ${new Date().toLocaleString("ru-RU")}`,
    ].join("\n");

    await this.bot.sendMessage(chatId, summary);
  }

  private sendAccessDeniedMessage(chatId: number, userId?: number): void {
    this.bot.sendMessage(
      chatId,
      `❌ Access denied.\n\n${
        userId ? `Your ID: ${userId}\n` : ""
      }Send your ID to administrator to get access.`
    );
  }

  public start(): void {
    console.log("🤖 Telegram bot started");
    console.log(
      `👥 Authorized users: ${this.authService.getAllowedUsers().length}`
    );
    console.log(`📋 ID list: ${this.authService.getAllowedUsers().join(", ")}`);
  }

  public stop(): void {
    this.bot.stopPolling();
    console.log("🛑 Telegram bot stopped");
  }
}

// Start bot if file is run directly
if (require.main === module) {
  const bot = new TelegramBotService();
  bot.start();

  // Process termination handling
  process.on("SIGINT", () => {
    console.log("\n👋 Received SIGINT signal, stopping bot...");
    bot.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n👋 Received SIGTERM signal, stopping bot...");
    bot.stop();
    process.exit(0);
  });
}
