# Telegram Bot - Setup Instructions

## What is this?

Telegram bot with restricted access for event management. The bot only works with whitelisted users.

## Step 1: Creating a bot in Telegram

1. Open Telegram and find [@BotFather](https://t.me/botfather)
2. Send the command `/newbot`
3. Enter the bot name (for example: "My Events Bot")
4. Enter the bot username (must end with `bot`, for example: `my_events_bot`)
5. **Save the token** that BotFather provides
   - Token looks like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

## Step 2: Getting your Telegram ID

1. Find the [@userinfobot](https://t.me/userinfobot) bot in Telegram
2. Send it any message
3. It will send you your ID (for example: `123456789`)
4. Save this ID

## Step 3: Configuring the .env file

Open the `.env` file and add/modify the following lines:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_token_from_botfather
TELEGRAM_ALLOWED_USER_IDS=your_telegram_id,other_user_id
```

**Example:**
```bash
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321
```

If you need to add more users, simply add their IDs separated by commas.

## Step 4: Starting the bot

### Development mode (with auto-reload):
```bash
npm run bot
```

### Production mode:
```bash
npm run bot:build
```

## Available bot commands

After starting the bot, authorized users can use the following commands:

- `/start` - Start working with the bot
- `/help` - Show list of available commands
- `/status` - Check bot status
- `/myid` - Get your Telegram ID
- `/parse` - Run event parsing
- `/events` - Get list of events

## Security

- Only users from the `TELEGRAM_ALLOWED_USER_IDS` list can use the bot
- When an unauthorized user tries to access, the bot will show a message with their ID
- You can add this ID to the `.env` file to grant access

## Project structure

```
src/bot/
├── types/
│   └── bot.types.ts          # TypeScript types
├── services/
│   └── auth.service.ts       # Authorization service
└── telegram-bot.ts            # Main bot file
```

## Adding new commands

To add a new command, open [src/bot/telegram-bot.ts](src/bot/telegram-bot.ts) and add a handler in the `setupCommands()` method:

```typescript
this.bot.onText(/\/mycommand/, (msg) => {
  const userId = msg.from?.id;
  if (!userId || !this.isUserAllowed(userId)) {
    this.sendAccessDeniedMessage(msg.chat.id, userId);
    return;
  }

  this.bot.sendMessage(msg.chat.id, 'Your response here');
});
```

## Stopping the bot

To properly stop the bot use:
- `Ctrl+C` in the terminal
- The bot will correctly finish its work and disconnect from the Telegram API

## Troubleshooting

### Bot doesn't respond
- Check that the token in the `.env` file is correct
- Make sure your ID is added to `TELEGRAM_ALLOWED_USER_IDS`

### Error "TELEGRAM_BOT_TOKEN not found"
- Make sure you created the `.env` file
- Check that the `.env` has the line `TELEGRAM_BOT_TOKEN=...`

### Bot says "Access denied"
- Use the `/myid` command to find out your ID
- Add this ID to the `.env` file in `TELEGRAM_ALLOWED_USER_IDS`
- Restart the bot

## Integration with existing code

You can integrate parsing functions into bot commands. For example:

```typescript
// In the setupCommands() method
this.bot.onText(/\/parse/, async (msg) => {
  // Import and call the parsing function
  const { parseEvents } = await import('../parse_events');
  // Call the function and send the result to the user
});
```
