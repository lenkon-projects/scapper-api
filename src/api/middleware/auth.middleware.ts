import { Request, Response, NextFunction } from 'express';
import { ChatIdTrackerService } from '../../bot/services/chat-id-tracker.service';
import { AuthService } from '../../bot/services/auth.service';

export interface AuthenticatedRequest extends Request {
  authenticatedUserId?: number;
  authMethod?: 'api_key' | 'user_token';
}

/**
 * Middleware для проверки аутентификации
 * Поддерживает два метода:
 * 1. X-API-Key: глобальный API ключ
 * 2. Authorization: Bearer tk_xxx или X-User-Token: tk_xxx
 */
export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    console.error('[Auth] API_KEY not configured in environment variables');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  // Метод 1: Проверка глобального API ключа (обратная совместимость)
  const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string;

  if (apiKey === validApiKey) {
    req.authMethod = 'api_key';
    next();
    return;
  }

  // Метод 2: Проверка пользовательского токена
  const authHeader = req.headers['authorization'] as string;
  let userToken: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    userToken = authHeader.substring(7);
  }

  // Альтернативный заголовок X-User-Token
  if (!userToken) {
    userToken = req.headers['x-user-token'] as string;
  }

  if (userToken) {
    const chatIdTracker = ChatIdTrackerService.getInstance();
    const userId = chatIdTracker.validateToken(userToken);

    if (userId) {
      // Проверяем авторизацию пользователя
      const allowedUserIds = process.env.TELEGRAM_ALLOWED_USER_IDS
        ? process.env.TELEGRAM_ALLOWED_USER_IDS.split(',').map(id => parseInt(id.trim(), 10))
        : [];

      const authService = new AuthService(allowedUserIds);

      if (authService.isUserAllowed(userId)) {
        req.authenticatedUserId = userId;
        req.authMethod = 'user_token';
        next();
        return;
      } else {
        res.status(403).json({ error: 'Forbidden: User not authorized' });
        return;
      }
    }
  }

  // Ни один метод не прошел
  res.status(401).json({ error: 'Unauthorized' });
};
