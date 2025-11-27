import * as fs from "fs";
import * as path from "path";
import { ChatIdMapping } from "../types/bot.types";

interface StorageFile {
  mappings: ChatIdMapping[];
  lastUpdated: string;
}

export class ChatIdTrackerService {
  private static instance: ChatIdTrackerService;
  private storageFilePath: string;
  private cache: Map<number, ChatIdMapping>;
  private isWritable: boolean = true;

  private constructor() {
    this.storageFilePath = path.join(process.cwd(), "data", "chat_ids.json");
    this.cache = new Map();
    this.loadFromFile();
  }

  public static getInstance(): ChatIdTrackerService {
    if (!ChatIdTrackerService.instance) {
      ChatIdTrackerService.instance = new ChatIdTrackerService();
    }
    return ChatIdTrackerService.instance;
  }

  /**
   * Track chat ID for a user
   */
  public trackChatId(
    userId: number,
    chatId: number,
    username?: string,
    firstName?: string
  ): void {
    const mapping: ChatIdMapping = {
      userId,
      chatId,
      username,
      firstName,
      lastInteraction: new Date().toISOString(),
    };

    this.cache.set(userId, mapping);
    this.saveToFile();

    console.log(
      `[ChatIdTracker] Tracked chat ID for user ${userId} (${
        username || firstName || "unknown"
      })`
    );
  }

  /**
   * Get chat ID for a specific user
   */
  public getChatId(userId: number): number | null {
    const mapping = this.cache.get(userId);
    return mapping ? mapping.chatId : null;
  }

  /**
   * Get all chat IDs for authorized users
   */
  public getAllChatIds(authorizedUserIds: number[]): ChatIdMapping[] {
    const mappings: ChatIdMapping[] = [];

    for (const userId of authorizedUserIds) {
      const mapping = this.cache.get(userId);
      if (mapping) {
        mappings.push(mapping);
      }
    }

    return mappings;
  }

  /**
   * Load mappings from file
   */
  private loadFromFile(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Check if file exists
      if (!fs.existsSync(this.storageFilePath)) {
        console.log("[ChatIdTracker] Storage file not found, creating new one");
        this.saveToFile();
        return;
      }

      // Read and parse
      const data = fs.readFileSync(this.storageFilePath, "utf-8");
      const parsed: StorageFile = JSON.parse(data);

      // Validate structure
      if (!parsed.mappings || !Array.isArray(parsed.mappings)) {
        throw new Error("Invalid file structure");
      }

      // Load into cache
      this.cache.clear();
      for (const mapping of parsed.mappings) {
        this.cache.set(mapping.userId, mapping);
      }

      console.log(`[ChatIdTracker] Loaded ${this.cache.size} chat ID mappings`);
    } catch (error) {
      console.error("[ChatIdTracker] Error loading chat IDs:", error);
      console.log("[ChatIdTracker] Starting with empty cache");
      this.cache.clear();

      // Try to save empty state
      try {
        this.saveToFile();
      } catch (saveError) {
        console.error("[ChatIdTracker] Cannot save to file:", saveError);
      }
    }
  }

  /**
   * Save mappings to file
   */
  private saveToFile(): void {
    // Skip if we already know the file is not writable
    if (!this.isWritable) {
      return;
    }

    try {
      // Ensure directory exists
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data: StorageFile = {
        mappings: Array.from(this.cache.values()),
        lastUpdated: new Date().toISOString(),
      };

      fs.writeFileSync(
        this.storageFilePath,
        JSON.stringify(data, null, 2),
        "utf-8"
      );
    } catch (error: any) {
      // Mark as not writable to avoid repeated errors
      if (error?.code === "EACCES" || error?.code === "EROFS") {
        console.warn(
          `[ChatIdTracker] Storage not writable (${error.code}), running in memory-only mode. ` +
            "Chat ID mappings will not persist across restarts."
        );
        this.isWritable = false;
      } else {
        console.error("[ChatIdTracker] Error saving chat IDs:", error);
      }
    }
  }
}
