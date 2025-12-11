/**
 * Zygo Token Service
 * Управление JWT токенами для Zygo API с автоматическим обновлением
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[ZygoTokenService] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ZygoTokenService] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[ZygoTokenService] ${msg}`, ...args),
};

interface ZygoTokens {
  access_token: string;
  refresh_token: string;
  access_token_expires: string;
  refresh_token_expires: string;
  user?: {
    id: string;
    phone: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  };
  lastUpdated: string;
}

interface ZygoAuthResponse {
  user: {
    id: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    phone?: string;
  };
  tokens: {
    access: {
      token: string;
      expires: string;
    };
    refresh: {
      token: string;
      expires: string;
    };
  };
}

class ZygoTokenService {
  private static instance: ZygoTokenService;
  private tokens: ZygoTokens | null = null;
  private readonly tokensFilePath: string;
  private readonly apiBaseURL = 'https://api.zygo.co.il';
  private readonly refreshBeforeExpiryMin: number;

  private constructor() {
    this.tokensFilePath = path.join(process.cwd(), 'data', 'zygo_tokens.json');
    this.refreshBeforeExpiryMin = parseInt(process.env.ZYGO_TOKEN_REFRESH_BEFORE_EXPIRY_MIN || '5', 10);

    // Создать директорию data если не существует
    const dataDir = path.dirname(this.tokensFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Загрузить токены при инициализации
    this.loadTokens();
  }

  /**
   * Получить единственный экземпляр сервиса
   */
  public static getInstance(): ZygoTokenService {
    if (!ZygoTokenService.instance) {
      ZygoTokenService.instance = new ZygoTokenService();
    }
    return ZygoTokenService.instance;
  }

  /**
   * Загрузить токены из файла
   */
  private loadTokens(): void {
    try {
      if (fs.existsSync(this.tokensFilePath)) {
        const data = fs.readFileSync(this.tokensFilePath, 'utf-8');
        this.tokens = JSON.parse(data);
        logger.info('Токены загружены из файла');
      } else {
        logger.warn('Файл токенов не найден, требуется авторизация');
      }
    } catch (error: any) {
      logger.error('Ошибка загрузки токенов:', error.message);
      this.tokens = null;
    }
  }

  /**
   * Сохранить токены в файл
   */
  private saveTokens(): void {
    try {
      if (this.tokens) {
        fs.writeFileSync(this.tokensFilePath, JSON.stringify(this.tokens, null, 2), 'utf-8');
        logger.info('Токены сохранены в файл');
      }
    } catch (error: any) {
      logger.error('Ошибка сохранения токенов:', error.message);
    }
  }

  /**
   * Установить новые токены
   */
  public setTokens(authResponse: ZygoAuthResponse): void {
    this.tokens = {
      access_token: authResponse.tokens.access.token,
      refresh_token: authResponse.tokens.refresh.token,
      access_token_expires: authResponse.tokens.access.expires,
      refresh_token_expires: authResponse.tokens.refresh.expires,
      user: {
        id: authResponse.user.id,
        phone: authResponse.user.phone || '',
        firstName: authResponse.user.firstName,
        lastName: authResponse.user.lastName,
        username: authResponse.user.username
      },
      lastUpdated: new Date().toISOString()
    };

    this.saveTokens();
    logger.info(`Токены установлены для пользователя: ${authResponse.user.username || authResponse.user.id}`);
  }

  /**
   * Проверить, истекает ли токен скоро
   */
  private isTokenExpiringSoon(expiresAt: string): boolean {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const minutesUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60);

    return minutesUntilExpiry < this.refreshBeforeExpiryMin;
  }

  /**
   * Обновить access токен используя refresh токен
   */
  public async refreshAccessToken(): Promise<void> {
    if (!this.tokens) {
      throw new Error('Нет токенов для обновления. Требуется авторизация.');
    }

    if (!this.tokens.refresh_token) {
      throw new Error('Refresh токен отсутствует');
    }

    logger.info('Обновление access токена...');

    try {
      const response = await axios.post<ZygoAuthResponse>(
        `${this.apiBaseURL}/v1/auth/refresh`,
        {
          refreshToken: this.tokens.refresh_token
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      // Обновить токены
      this.setTokens(response.data);
      logger.info('✅ Access токен успешно обновлён');
    } catch (error: any) {
      logger.error('❌ Ошибка обновления токена:', error.response?.data || error.message);
      throw new Error(`Не удалось обновить токен: ${error.message}`);
    }
  }

  /**
   * Получить валидный access токен (с автообновлением)
   */
  public async getAccessToken(): Promise<string | null> {
    if (!this.tokens) {
      logger.warn('Токены отсутствуют. Требуется авторизация через /zygo_auth');
      return null;
    }

    // Проверить срок действия access токена
    if (this.isTokenExpiringSoon(this.tokens.access_token_expires)) {
      logger.info(`⏰ Access токен истекает через < ${this.refreshBeforeExpiryMin} минут, обновление...`);
      await this.refreshAccessToken();
    }

    return this.tokens.access_token;
  }

  /**
   * Проверить валидность refresh токена
   */
  public isRefreshTokenValid(): boolean {
    if (!this.tokens || !this.tokens.refresh_token_expires) {
      return false;
    }

    const expiryDate = new Date(this.tokens.refresh_token_expires);
    const now = new Date();

    return expiryDate > now;
  }

  /**
   * Получить информацию о пользователе
   */
  public getUserInfo(): ZygoTokens['user'] | null {
    return this.tokens?.user || null;
  }

  /**
   * Проверить наличие токенов
   */
  public hasTokens(): boolean {
    return this.tokens !== null && !!this.tokens.access_token && !!this.tokens.refresh_token;
  }

  /**
   * Очистить токены (для выхода из системы)
   */
  public clearTokens(): void {
    this.tokens = null;
    if (fs.existsSync(this.tokensFilePath)) {
      fs.unlinkSync(this.tokensFilePath);
      logger.info('Токены удалены');
    }
  }

  /**
   * Получить статус токенов
   */
  public getTokenStatus(): {
    hasTokens: boolean;
    accessTokenExpires?: string;
    refreshTokenExpires?: string;
    isRefreshTokenValid: boolean;
    minutesUntilAccessExpiry?: number;
  } {
    if (!this.tokens) {
      return {
        hasTokens: false,
        isRefreshTokenValid: false
      };
    }

    const now = new Date();
    const accessExpiryDate = new Date(this.tokens.access_token_expires);
    const minutesUntilAccessExpiry = Math.floor((accessExpiryDate.getTime() - now.getTime()) / (1000 * 60));

    return {
      hasTokens: true,
      accessTokenExpires: this.tokens.access_token_expires,
      refreshTokenExpires: this.tokens.refresh_token_expires,
      isRefreshTokenValid: this.isRefreshTokenValid(),
      minutesUntilAccessExpiry
    };
  }
}

export default ZygoTokenService;
