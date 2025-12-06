import { randomBytes } from 'crypto';

/**
 * Генерирует безопасный токен с префиксом tk_
 * Формат: tk_{16 случайных буквенно-цифровых символов}
 * Пример: tk_7aB9xY2zK4mN8pQ1
 */
export function generateUserToken(): string {
  // Генерируем 12 случайных байт (получится ~16 символов в base64)
  const randomPart = randomBytes(12)
    .toString('base64')
    .replace(/\+/g, '0')  // Заменяем + на 0
    .replace(/\//g, '1')  // Заменяем / на 1
    .replace(/=/g, '')    // Убираем padding символы
    .substring(0, 16);    // Берем первые 16 символов

  return `tk_${randomPart}`;
}

/**
 * Валидация формата токена
 */
export function isValidTokenFormat(token: string): boolean {
  // Проверяем формат: префикс tk_ + 16 буквенно-цифровых символов
  const tokenRegex = /^tk_[A-Za-z0-9]{16}$/;
  return tokenRegex.test(token);
}

/**
 * Генерирует уникальный токен с проверкой коллизий
 */
export function generateUniqueToken(existingTokens: string[]): string {
  let token: string;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    token = generateUserToken();
    attempts++;

    if (attempts > maxAttempts) {
      throw new Error('Failed to generate unique token after multiple attempts');
    }
  } while (existingTokens.includes(token));

  return token;
}
