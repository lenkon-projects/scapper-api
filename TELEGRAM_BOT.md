# Telegram Bot - Инструкция по настройке

## Что это?

Telegram бот с ограниченным доступом для управления событиями. Бот работает только с пользователями из белого списка.

## Шаг 1: Создание бота в Telegram

1. Откройте Telegram и найдите [@BotFather](https://t.me/botfather)
2. Отправьте команду `/newbot`
3. Введите имя бота (например: "My Events Bot")
4. Введите username бота (должен заканчиваться на `bot`, например: `my_events_bot`)
5. **Сохраните токен**, который выдаст BotFather
   - Токен выглядит так: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

## Шаг 2: Получение вашего Telegram ID

1. Найдите бота [@userinfobot](https://t.me/userinfobot) в Telegram
2. Отправьте ему любое сообщение
3. Он пришлет ваш ID (например: `123456789`)
4. Сохраните этот ID

## Шаг 3: Настройка .env файла

Откройте файл `.env` и добавьте/измените следующие строки:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=ваш_токен_от_botfather
TELEGRAM_ALLOWED_USER_IDS=ваш_telegram_id,id_другого_пользователя
```

**Пример:**
```bash
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321
```

Если нужно добавить больше пользователей, просто добавляйте их ID через запятую.

## Шаг 4: Запуск бота

### Режим разработки (с автоперезагрузкой):
```bash
npm run bot
```

### Продакшн режим:
```bash
npm run bot:build
```

## Доступные команды бота

После запуска бота, авторизованные пользователи могут использовать следующие команды:

- `/start` - Начать работу с ботом
- `/help` - Показать список доступных команд
- `/status` - Проверить статус бота
- `/myid` - Узнать свой Telegram ID
- `/parse` - Запустить парсинг событий
- `/events` - Получить список событий

## Безопасность

- Только пользователи из списка `TELEGRAM_ALLOWED_USER_IDS` могут использовать бота
- При попытке доступа неавторизованного пользователя, бот покажет сообщение с его ID
- Вы можете добавить этот ID в `.env` файл, чтобы разрешить доступ

## Структура проекта

```
src/bot/
├── types/
│   └── bot.types.ts          # Типы для TypeScript
├── services/
│   └── auth.service.ts       # Сервис авторизации
└── telegram-bot.ts            # Основной файл бота
```

## Добавление новых команд

Чтобы добавить новую команду, откройте [src/bot/telegram-bot.ts](src/bot/telegram-bot.ts) и добавьте обработчик в метод `setupCommands()`:

```typescript
this.bot.onText(/\/mycommand/, (msg) => {
  const userId = msg.from?.id;
  if (!userId || !this.isUserAllowed(userId)) {
    this.sendAccessDeniedMessage(msg.chat.id, userId);
    return;
  }

  this.bot.sendMessage(msg.chat.id, 'Ваш ответ здесь');
});
```

## Остановка бота

Для корректной остановки бота используйте:
- `Ctrl+C` в терминале
- Бот корректно завершит работу и отключится от Telegram API

## Troubleshooting

### Бот не отвечает
- Проверьте, что токен в `.env` файле правильный
- Убедитесь, что ваш ID добавлен в `TELEGRAM_ALLOWED_USER_IDS`

### Ошибка "TELEGRAM_BOT_TOKEN не найден"
- Убедитесь, что вы создали `.env` файл
- Проверьте, что в `.env` есть строка `TELEGRAM_BOT_TOKEN=...`

### Бот говорит "Доступ запрещен"
- Используйте команду `/myid`, чтобы узнать свой ID
- Добавьте этот ID в `.env` файл в `TELEGRAM_ALLOWED_USER_IDS`
- Перезапустите бота

## Интеграция с существующим кодом

Вы можете интегрировать функции парсинга в команды бота. Например:

```typescript
// В методе setupCommands()
this.bot.onText(/\/parse/, async (msg) => {
  // Импортировать и вызвать функцию парсинга
  const { parseEvents } = await import('../parse_events');
  // Вызвать функцию и отправить результат пользователю
});
```
