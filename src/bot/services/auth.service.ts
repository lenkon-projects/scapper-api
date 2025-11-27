import { BotConfig } from '../types/bot.types';

export class AuthService {
  private allowedUserIds: Set<number>;

  constructor(allowedUserIds: number[]) {
    this.allowedUserIds = new Set(allowedUserIds);
  }

  isUserAllowed(userId: number): boolean {
    return this.allowedUserIds.has(userId);
  }

  addUser(userId: number): void {
    this.allowedUserIds.add(userId);
  }

  removeUser(userId: number): void {
    this.allowedUserIds.delete(userId);
  }

  getAllowedUsers(): number[] {
    return Array.from(this.allowedUserIds);
  }
}
