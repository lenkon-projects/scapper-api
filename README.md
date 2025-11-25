# WordPress Events Parser

Node.js parser for extracting event data from WordPress admin panel with authentication and bot protection bypass.

## Features

- WordPress authentication with bot protection bypass (uPress/Cloudflare)
- Parses events table from WordPress admin
- Extracts minimal event data: active status, event ID, tickets sold, capacity
- Saves results to JSON with timestamp
- Takes full-page screenshot for verification
- Configurable headless/visible browser mode

## Requirements

- Node.js (v14+)
- npm

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file with your WordPress credentials:

```env
# WordPress Login Credentials
WP_LOGIN_URL=https://ozentelaviv.com/wp-login.php
WP_USERNAME=your_email@example.com
WP_PASSWORD=your_password

# Target URLs to parse
TARGET_URL=https://ozentelaviv.com/wp-admin/

# Browser settings
HEADLESS=true
TIMEOUT=30000
CLOSE_BROWSER=true
```

### Environment Variables

- `WP_LOGIN_URL` - WordPress login page URL
- `WP_USERNAME` - WordPress admin username/email
- `WP_PASSWORD` - WordPress admin password
- `HEADLESS` - Run browser in headless mode (`true`/`false`)
- `TIMEOUT` - Page load timeout in milliseconds
- `CLOSE_BROWSER` - Close browser after parsing (`true`/`false`)

## Usage

Run the parser:

```bash
npm run events
```

Or directly:

```bash
node parse_events.js
```

## Output

The script creates an `output` directory with:

1. **JSON file** - `events_[timestamp].json` with parsed data
2. **Screenshot** - `events_screenshot.png` for verification

### JSON Structure

```json
[
  {
    "active": true,
    "eventId": "146628",
    "ticketsSold": {
      "total": 4,
      "capacity": 220
    }
  }
]
```

### Fields Description

- `active` (boolean) - Whether the event is currently active
- `eventId` (string) - Unique event identifier
- `ticketsSold.total` (number) - Total tickets sold (סה״כ)
- `ticketsSold.capacity` (number) - Original event capacity (מלאי מקורי)

## How It Works

1. Launches Puppeteer with stealth plugin to bypass bot detection
2. Waits for uPress/Cloudflare protection screen to pass
3. Authenticates with WordPress credentials
4. Navigates to events admin page (`edit.php?post_type=tc_events`)
5. Parses the events table using CSS selectors:
   - `td.column-event_active .tc-control` - for active status
   - `td.column-tickets_sold` - for ticket data
6. Extracts data using regex patterns for Hebrew text
7. Saves results to JSON and takes screenshot

## Debugging

To debug with visible browser:

```env
HEADLESS=false
CLOSE_BROWSER=false
```

This keeps the browser open after execution for manual inspection.

### Debug Script

Use `debug_table.js` to analyze table structure:

```bash
node debug_table.js
```

This shows:
- Table headers and their classes
- First row data structure
- tc-control element details

## Technical Details

### Dependencies

- `puppeteer` - Browser automation
- `puppeteer-extra` - Plugin framework
- `puppeteer-extra-plugin-stealth` - Bot detection bypass
- `dotenv` - Environment configuration

### Bot Protection Bypass

The script uses several techniques:
- Stealth plugin to hide automation indicators
- Custom user agent
- Webdriver property override
- Delays to simulate human behavior
- Proper viewport configuration

## Troubleshooting

**Login fails:**
- Check credentials in `.env`
- Set `HEADLESS=false` to watch the process
- Increase delays if site is slow

**Protection timeout:**
- Script continues automatically after 20s timeout
- Increase `TIMEOUT` value if needed

**Table not found:**
- Verify you have access to the events page
- Check if table structure changed
- Run `debug_table.js` to inspect current structure

**Wrong data extracted:**
- Table structure may have changed
- Use `debug_table.js` to verify column classes
- Update selectors in `parse_events.js` if needed

## Security Notes

- Never commit `.env` file (included in `.gitignore`)
- Use `.env.example` as template
- Credentials are loaded from environment variables only

## License

ISC
