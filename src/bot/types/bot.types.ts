import { Context } from 'grammy';

export type BotContext = Context;

export interface BotConfig {
  token: string;
  allowedUserIds: number[];
}

export interface BotCommand {
  command: string;
  description: string;
}

export interface UserInfo {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
}

export interface ChatIdMapping {
  userId: number;
  chatId: number;
  username?: string;
  firstName?: string;
  lastInteraction: string;
  token?: string;
}

export interface NotificationResult {
  sent: number;
  failed: number;
  details: {
    chatId: number;
    userId: number;
    success: boolean;
    error?: string;
  }[];
}

export interface NotificationOptions {
  parseMode?: 'Markdown' | 'HTML';
  disableWebPagePreview?: boolean;
}
