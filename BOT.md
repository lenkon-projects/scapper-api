# Telegram Bot Documentation

The WordPress Events Management Platform includes a comprehensive Telegram bot that provides real-time notifications, command interface, and secure user authentication for managing event parsing and Monday.com synchronization.

## Overview

The Telegram bot offers:

- **User Authentication** - Whitelist-based access control
- **Real-time Notifications** - Parse results and sync status updates
- **Interactive Commands** - Parse triggers, status checks, and help
- **Error Reporting** - Detailed error messages and troubleshooting
- **Chat Management** - User ID tracking and session management

## Bot Setup

### Step 1: Create Telegram Bot

1. Open Telegram and find [@BotFather](https://t.me/botfather)
2. Send `/newbot` command
3. Enter bot name (e.g., "WordPress Events Bot")
4. Enter username (must end with `bot`, e.g., `wordpress_events_bot`)
5. **Save the token** provided by BotFather

**Example token format:**

```
1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789
```

### Step 2: Get Your Telegram User ID

1. Find [@userinfobot](https://t.me/userinfobot) in Telegram
2. Send any message to get your user ID
3. Save your ID (e.g., `123456789`)

### Step 3: Configure Environment Variables

Add these to your `.env` file:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321,555444333
```

**Multiple Users:**
Add multiple user IDs separated by commas. Only these users can access the bot.

### Step 4: Start the Bot

#### Development Mode

```bash
npm run bot:dev
```

#### Production Mode

```bash
npm run bot:prod

# Or as part of full platform
npm run start:all:prod
```

## Available Commands

### `/start` - Welcome & Authentication

Initializes bot interaction and checks user authorization.

**Usage:**

```
/start
```

**Authorized User Response:**

```
👋 Hello, username!

Welcome to the events management bot.

Available commands:
/help - Command list
/parseandsync - Parse and sync
/status - Bot status
/myid - Get your ID
```

**Unauthorized User Response:**

```
❌ Sorry, you don't have access to this bot.

Your ID: 123456789
Send this ID to administrator to get access.
```

---

### `/help` - Command List

Shows all available commands with descriptions.

**Usage:**

```
/help
```

**Response:**

```
📖 Available commands:

/start - Start working with the bot
/help - Show this message
/status - Check bot status
/myid - Get your Telegram ID
/parseandsync - Run parsing and synchronization with Monday.com
/events - Get events list
```

---

### `/status` - Bot Status

Check bot operational status and user count.

**Usage:**

```
/status
```

**Response:**

```
✅ Bot is working normally

👥 Authorized users: 3
```

---

### `/myid` - Get User Information

Display your Telegram ID and access status.

**Usage:**

```
/myid
```

**Response:**

```
🆔 Your Telegram ID: 123456789
👤 Username: @username
✅ Access granted
```

---

### `/parseandsync` - Parse and Sync Events

**⚠️ Main Command** - Triggers complete parsing and Monday.com synchronization workflow.

**Usage:**

```
/parseandsync
```

**Workflow Response:**

**Step 1: Starting**

```
🔄 Starting parsing...

This may take some time.
```

**Step 2: Parse Results**

```
✅ Parsing completed!

📊 Total events: 25
📁 File: events_1732708380000.json
```

**Step 3: Filtering**

```
🔍 Found active events: 12 out of 25
```

**Step 4: Monday.com Sync**

```
🔄 Starting synchronization with Monday.com...
```

**Step 5: Final Results**

```
✅ Synchronization completed!

📊 Results:
• Processed: 12
• Successfully updated: 10
• Skipped: 1
• Errors: 1

⏰ Time: 11/27/2025, 10:33:00 AM
```

**Error Response:**

```
❌ Error: Failed to authenticate with WordPress
```

---

### `/events` - Get Events List

Lists recent events data (implementation varies by setup).

**Usage:**

```
/events
```

**Response:**

```
📋 Getting events list...

[Events data would be displayed here based on implementation]
```

## User Authentication System

### Whitelist Configuration

The bot uses a strict whitelist approach for security:

```bash
# Single user
TELEGRAM_ALLOWED_USER_IDS=123456789

# Multiple users
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321,555444333
```

### Authentication Flow

1. **User sends command** → Bot checks user ID against whitelist
2. **Authorized user** → Command executes normally
3. **Unauthorized user** → Access denied message with user ID

### Adding New Users

1. User sends `/myid` or any command to get their ID
2. Administrator adds ID to `TELEGRAM_ALLOWED_USER_IDS` in `.env`
3. Restart bot for changes to take effect
4. User can now access all commands

## Chat ID Tracking

The bot automatically tracks user interactions for notification delivery:

### Tracked Information

- **User ID**: Telegram user identifier
- **Chat ID**: Chat session identifier
- **Username**: Telegram username (if available)
- **First Name**: User's first name
- **Last Interaction**: Timestamp of latest message

### Data Usage

- **Notifications**: Send updates to all tracked authorized users
- **Session Management**: Maintain chat context
- **Debugging**: Track user activity and errors

## Error Handling & Responses

### Common Error Scenarios

**WordPress Authentication Failure:**

```
❌ Error: Failed to authenticate with WordPress

Please check WordPress credentials in configuration.
```

**Monday.com API Error:**

```
❌ Error: Monday.com API error: Invalid API key

Please verify Monday.com configuration.
```

**Parse Timeout:**

```
❌ Error: Parse operation timed out

The WordPress site may be slow or unreachable.
```

**No Active Events:**

```
⚠️ No active events for synchronization

Parse completed but found no events to sync with Monday.com.
```

### Error Reporting

All errors include:

- Clear description of the issue
- Suggested troubleshooting steps
- Timestamp of occurrence
- Correlation with system logs

## Notification System

### Notification Service

The bot includes a notification service for sending updates to all authorized users:

```typescript
// Send notification to all users
await TelegramNotificationService.getInstance().sendToAllUsers(
  "📊 New events data available!"
);
```

### Notification Types

1. **Parse Completion** - When parsing finishes
2. **Sync Results** - Monday.com synchronization status
3. **Error Alerts** - Critical system errors
4. **Status Updates** - System maintenance or changes

### Delivery Features

- **Broadcast to all authorized users**
- **Markdown formatting support**
- **Automatic retry on failures**
- **Delivery status tracking**
- **Rate limiting compliance**

## Security Features

### Access Control

- **Whitelist-only access** - Only pre-approved users
- **User ID verification** - Each command checks authorization
- **Access denial logging** - Unauthorized attempts are logged
- **ID disclosure for admins** - Unknown users get their ID for approval

### Data Protection

- **No sensitive data in messages** - Credentials never exposed
- **Secure token storage** - Bot token in environment variables
- **Session isolation** - Each user has separate chat context
- **Audit trail** - All interactions are logged

### Rate Limiting

- **Telegram API compliance** - Respects API rate limits
- **Command cooldowns** - Prevents spam and abuse
- **Error rate limiting** - Prevents error message floods

## Configuration Options

### Environment Variables

```bash
# Required: Bot Token from @BotFather
TELEGRAM_BOT_TOKEN=your_bot_token

# Required: Comma-separated user IDs
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321

# Optional: Custom API URL (default: api.telegram.org)
TELEGRAM_API_URL=https://api.telegram.org

# Optional: Request timeout in milliseconds (default: 10000)
TELEGRAM_TIMEOUT=10000

# Optional: Bot polling interval (default: 1000)
TELEGRAM_POLLING_INTERVAL=1000
```

### Bot Configuration Object

```typescript
interface BotConfig {
  token: string;
  allowedUserIds: number[];
  apiUrl?: string;
  timeout?: number;
  pollingInterval?: number;
}
```

## Integration with Platform Services

### WordPress Scraper Integration

The bot directly calls the core scraper service:

```typescript
import { executeParse } from "../core/scraper";

const parseResult = await executeParse({
  headless: true,
  closeAfter: true,
});
```

### Monday.com Service Integration

Automatic synchronization with Monday.com:

```typescript
import MondayService from "../api/services/monday.service";

const mondayService = MondayService.getInstance();
const syncResult = await mondayService.syncActiveEvents(events, timestamp);
```

### Notification Integration

Platform services can send notifications via bot:

```typescript
import { TelegramNotificationService } from "../bot/services/telegram-notification.service";

await TelegramNotificationService.getInstance().sendToAllUsers(
  "✅ Automated sync completed!"
);
```

## Development & Customization

### Adding New Commands

Add new commands by extending the `setupCommands()` method:

```typescript
// In src/bot/telegram-bot.ts
private setupCommands(): void {
  // ... existing commands

  // New custom command
  this.bot.onText(/\/mycustomcommand/, async (msg) => {
    const userId = msg.from?.id;

    if (!userId || !this.isUserAllowed(userId)) {
      this.sendAccessDeniedMessage(msg.chat.id, userId);
      return;
    }

    // Track interaction
    this.trackUserInteraction(
      userId,
      msg.chat.id,
      msg.from?.username,
      msg.from?.first_name
    );

    // Command logic
    await this.bot.sendMessage(msg.chat.id, "Custom command response");
  });
}
```

### Command Handler Template

```typescript
this.bot.onText(/\/commandname/, async (msg) => {
  const userId = msg.from?.id;
  const chatId = msg.chat.id;

  // Validate user
  if (!userId || !this.isUserAllowed(userId)) {
    this.sendAccessDeniedMessage(chatId, userId);
    return;
  }

  // Track interaction
  this.trackUserInteraction(
    userId,
    chatId,
    msg.from?.username,
    msg.from?.first_name
  );

  try {
    // Command implementation
    await this.bot.sendMessage(chatId, "Command executed successfully");
  } catch (error) {
    console.error("Command error:", error);
    await this.bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});
```

### Message Formatting

The bot supports Markdown formatting:

```typescript
// Bold and italic text
await this.bot.sendMessage(chatId, "*Bold* and _italic_ text");

// Code blocks
await this.bot.sendMessage(chatId, "`code snippet`");

// Links
await this.bot.sendMessage(chatId, "[Link text](https://example.com)");

// Lists
const message = `
📊 *Parse Results:*
• Total events: ${total}
• Active events: ${active}
• Updated: ${updated}
`;
await this.bot.sendMessage(chatId, message);
```

## Troubleshooting

### Bot Not Responding

**Check Token:**

```bash
# Verify token in .env file
grep TELEGRAM_BOT_TOKEN .env
```

**Verify Bot Creation:**

1. Message @BotFather with `/mybots`
2. Confirm bot exists and token is correct
3. Check bot username matches your configuration

### Access Denied Issues

**Check User ID:**

```bash
# Send /myid to the bot to get your ID
# Add ID to TELEGRAM_ALLOWED_USER_IDS in .env
```

**Verify Configuration:**

```bash
# Check user IDs in environment
grep TELEGRAM_ALLOWED_USER_IDS .env

# Restart bot after changes
npm run bot:dev
```

### Connection Issues

**Network Connectivity:**

```bash
# Test Telegram API connectivity
curl -X GET "https://api.telegram.org/bot<your-token>/getMe"
```

**Firewall/Proxy:**

- Ensure outbound HTTPS (443) is allowed
- Check corporate firewalls or proxies
- Verify DNS resolution for api.telegram.org

### Command Execution Errors

**WordPress Connection:**

- Verify WordPress credentials in `.env`
- Check WordPress site accessibility
- Test manual login to WordPress admin

**Monday.com Integration:**

- Verify Monday.com API key
- Check board ID and column IDs
- Test Monday.com API connectivity

### Logging & Debugging

**Enable Debug Logging:**

```bash
# Set log level in .env
LOG_LEVEL=debug

# View bot logs
npm run bot:dev | grep -i telegram
```

**Bot Service Logs:**

```bash
# Check bot service status
ps aux | grep telegram-bot

# View process logs
tail -f logs/bot.log
```

## Production Deployment

### Process Management

**PM2 Configuration:**

```json
{
  "name": "telegram-bot",
  "script": "dist/bot/telegram-bot.js",
  "instances": 1,
  "env": {
    "NODE_ENV": "production"
  }
}
```

**Systemd Service:**

```ini
[Unit]
Description=Telegram Bot Service
After=network.target

[Service]
Type=simple
User=app
WorkingDirectory=/app
ExecStart=/usr/bin/node dist/bot/telegram-bot.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Monitoring

**Health Checks:**

```bash
# Check bot process
pgrep -f telegram-bot

# Test bot responsiveness
curl -X GET "https://api.telegram.org/bot<token>/getMe"
```

**Log Monitoring:**

```bash
# Monitor error patterns
tail -f logs/combined.log | grep -i "telegram.*error"

# Check user activity
tail -f logs/combined.log | grep -i "telegram.*user"
```

### Security in Production

**Environment Security:**

```bash
# Secure .env file permissions
chmod 600 .env

# Verify token security
grep -v "^#" .env | grep -i telegram
```

**Access Monitoring:**

```bash
# Monitor unauthorized access attempts
grep "Access denied" logs/combined.log

# Track user additions
grep "user.*added" logs/combined.log
```

## API Integration

### Webhook Mode (Advanced)

For high-volume production deployments, consider webhook mode:

```typescript
// Webhook configuration
const webhookUrl = "https://your-domain.com/webhook/telegram";
await bot.setWebHook(webhookUrl);

// Express webhook handler
app.post("/webhook/telegram", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});
```

### Bot API Extensions

Extend bot capabilities with additional Telegram Bot API features:

```typescript
// Inline keyboards
const options = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "Parse Now", callback_data: "parse" },
        { text: "Status", callback_data: "status" },
      ],
    ],
  },
};

await bot.sendMessage(chatId, "Choose action:", options);
```

## Best Practices

### Command Design

- Keep commands simple and intuitive
- Provide clear feedback for all actions
- Handle errors gracefully with helpful messages
- Use consistent formatting and terminology

### User Experience

- Respond quickly to acknowledge commands
- Provide progress updates for long operations
- Use emojis for better visual feedback
- Include help text for complex operations

### Security

- Regularly rotate bot tokens
- Monitor unauthorized access attempts
- Audit user list periodically
- Log all administrative actions

### Performance

- Implement command rate limiting
- Cache frequently accessed data
- Use async/await for better responsiveness
- Monitor memory usage and restart if needed
