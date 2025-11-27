import axios from 'axios';
import dotenv from 'dotenv';
import { ChatIdTrackerService } from './chat-id-tracker.service';
import { AuthService } from './auth.service';
import { NotificationResult, NotificationOptions } from '../types/bot.types';

dotenv.config();

export class TelegramNotificationService {
  private static instance: TelegramNotificationService;
  private botToken: string;
  private chatIdTracker: ChatIdTrackerService;
  private authService: AuthService;

  private constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN not found in environment variables');
    }

    const allowedUserIds = process.env.TELEGRAM_ALLOWED_USER_IDS
      ? process.env.TELEGRAM_ALLOWED_USER_IDS.split(',').map((id) =>
          parseInt(id.trim(), 10)
        )
      : [];

    this.botToken = token;
    this.chatIdTracker = ChatIdTrackerService.getInstance();
    this.authService = new AuthService(allowedUserIds);
  }

  public static getInstance(): TelegramNotificationService {
    if (!TelegramNotificationService.instance) {
      TelegramNotificationService.instance = new TelegramNotificationService();
    }
    return TelegramNotificationService.instance;
  }

  /**
   * Broadcast message to all authorized users
   */
  public async broadcastToAllUsers(
    message: string,
    options?: NotificationOptions
  ): Promise<NotificationResult> {
    const authorizedUserIds = this.authService.getAllowedUsers();
    const chatMappings = this.chatIdTracker.getAllChatIds(authorizedUserIds);

    const result: NotificationResult = {
      sent: 0,
      failed: 0,
      details: [],
    };

    // Check if we have any users to notify
    if (chatMappings.length === 0) {
      console.warn(
        '[TelegramNotification] No users have interacted with bot yet. No notifications sent.'
      );
      return result;
    }

    if (chatMappings.length < authorizedUserIds.length) {
      const missingCount = authorizedUserIds.length - chatMappings.length;
      console.warn(
        `[TelegramNotification] ${missingCount} authorized users have not interacted with bot yet.`
      );
    }

    // Split message if too long
    const messageParts = this.splitMessage(message);

    // Send to each user
    for (const mapping of chatMappings) {
      try {
        // Send all parts sequentially
        for (const part of messageParts) {
          await this.sendMessage(mapping.chatId, part, options);

          // Small delay between parts to avoid rate limiting
          if (messageParts.length > 1) {
            await this.delay(100);
          }
        }

        result.sent++;
        result.details.push({
          chatId: mapping.chatId,
          userId: mapping.userId,
          success: true,
        });

        // Delay between users to respect rate limits (20 messages/sec)
        await this.delay(50);
      } catch (error) {
        result.failed++;
        result.details.push({
          chatId: mapping.chatId,
          userId: mapping.userId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        console.error(
          `[TelegramNotification] Failed to send to user ${mapping.userId}:`,
          error
        );
      }
    }

    return result;
  }

  /**
   * Format error message for Telegram
   */
  public formatErrorMessage(error: Error, context?: string): string {
    const timestamp = new Date().toISOString();
    const separator = '─'.repeat(40);

    let message = `🚨 *ERROR ALERT*\n${separator}\n\n`;

    if (context) {
      message += `📍 *Context:* ${context}\n\n`;
    }

    message += `⏰ *Time:* ${timestamp}\n\n`;
    message += `❌ *Error:* ${this.escapeMarkdown(error.message)}\n\n`;

    if (error.stack) {
      // Truncate stack trace if too long
      const stackLines = error.stack.split('\n');
      const truncatedStack = stackLines.slice(0, 15).join('\n');
      message += `📋 *Stack Trace:*\n\`\`\`\n${truncatedStack}\n\`\`\`\n`;

      if (stackLines.length > 15) {
        message += `\n_Stack trace truncated, showing first 15 lines_\n`;
      }
    }

    return message;
  }

  /**
   * Send message to specific chat via Telegram API
   */
  private async sendMessage(
    chatId: number,
    message: string,
    options?: NotificationOptions
  ): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    const payload = {
      chat_id: chatId,
      text: message,
      parse_mode: options?.parseMode || 'Markdown',
      disable_web_page_preview: options?.disableWebPagePreview ?? true,
    };

    try {
      const response = await axios.post(url, payload, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.data.ok) {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMsg =
          error.response?.data?.description || error.message;
        throw new Error(`Failed to send message: ${errorMsg}`);
      }
      throw error;
    }
  }

  /**
   * Split long messages into multiple parts
   */
  private splitMessage(message: string, maxLength: number = 4096): string[] {
    if (message.length <= maxLength) {
      return [message];
    }

    const chunks: string[] = [];
    let currentChunk = '';
    const lines = message.split('\n');

    for (const line of lines) {
      if ((currentChunk + line + '\n').length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }

        // If single line is too long, split it
        if (line.length > maxLength) {
          for (let i = 0; i < line.length; i += maxLength) {
            chunks.push(line.substring(i, i + maxLength));
          }
        } else {
          currentChunk = line + '\n';
        }
      } else {
        currentChunk += line + '\n';
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Escape special characters for Markdown
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }

  /**
   * Delay helper
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
