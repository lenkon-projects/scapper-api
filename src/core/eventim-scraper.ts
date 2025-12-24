import "dotenv/config";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Page, Browser } from "puppeteer";
import * as fs from "fs";
import * as path from "path";
import {
  EventimParseOptions,
  EventimParseResult,
  EventimEvent,
} from "./eventim.types";
import { delay } from "./utils";
import { JSDOM } from "jsdom";

puppeteer.use(StealthPlugin());

/**
 * EventimScraper - Multi-step parser for webreporting.eventim.de
 *
 * Flow:
 * 1. Select system (CTS Israel)
 * 2. Login with Connect-ID credentials
 * 3. Select user profile
 * 4. Navigate to STOwnEvents report
 * 5. Submit form and open HTML report
 * 6. Parse the report table
 */
export class EventimScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private options: EventimParseOptions;
  private debugDir: string;
  private runId: string;

  private readonly BASE_URL = "https://webreporting.eventim.de/webreporting/";
  private readonly REPORT_URL =
    "https://webreporting.eventim.de/webreporting/STOwnEvents.aspx";

  constructor(options: EventimParseOptions = {}) {
    this.options = {
      headless: options.headless ?? process.env.HEADLESS === "true",
      closeAfter: options.closeAfter ?? process.env.CLOSE_BROWSER !== "false",
    };

    // Create unique run ID for this execution
    this.runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    this.debugDir = `./output/debug/eventim_${this.runId}`;

    // Clean up old debug folders before starting
    this.cleanupDebugDir();
    this.cleanupOldReports();

    // Create debug directory for this run
    if (!fs.existsSync(this.debugDir)) {
      fs.mkdirSync(this.debugDir, { recursive: true });
    }

    console.log(`📁 Debug folder: ${this.debugDir}`);
  }

  /**
   * Clean up all old debug directories from previous runs
   */
  private cleanupDebugDir(): void {
    const debugBaseDir = "./output/debug";
    if (!fs.existsSync(debugBaseDir)) return;

    const folders = fs
      .readdirSync(debugBaseDir)
      .filter((f) => {
        const fullPath = path.join(debugBaseDir, f);
        return (
          fs.statSync(fullPath).isDirectory() && f.startsWith("eventim_")
        );
      });

    let removedCount = 0;

    for (const folder of folders) {
      const folderPath = path.join(debugBaseDir, folder);
      try {
        const files = fs.readdirSync(folderPath);
        for (const file of files) {
          fs.unlinkSync(path.join(folderPath, file));
        }
        fs.rmdirSync(folderPath);
        removedCount++;
      } catch (e) {
        console.log(`⚠️ Could not remove folder ${folder}`);
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 Cleaned ${removedCount} old debug folders`);
    }
  }

  /**
   * Clean up old reports and screenshots, keeping only the latest one
   */
  private cleanupOldReports(): void {
    const outputDir = "./output";
    if (!fs.existsSync(outputDir)) return;

    const files = fs.readdirSync(outputDir);

    // Get eventim reports and screenshots
    const reports = files
      .filter((f) => f.startsWith("eventim_report_") && f.endsWith(".json"))
      .map((f) => ({
        name: f,
        time: fs.statSync(path.join(outputDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time);

    const screenshots = files
      .filter((f) => f.startsWith("eventim_screenshot_") && f.endsWith(".png"))
      .map((f) => ({
        name: f,
        time: fs.statSync(path.join(outputDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time);

    // Remove all but the latest report
    let removedCount = 0;
    for (let i = 1; i < reports.length; i++) {
      fs.unlinkSync(path.join(outputDir, reports[i].name));
      removedCount++;
    }

    // Remove all but the latest screenshot
    for (let i = 1; i < screenshots.length; i++) {
      fs.unlinkSync(path.join(outputDir, screenshots[i].name));
      removedCount++;
    }

    if (removedCount > 0) {
      console.log(`🧹 Cleaned old reports (${removedCount} files removed)`);
    }
  }

  /**
   * Save debug screenshot
   */
  private async saveDebugScreenshot(step: string): Promise<void> {
    if (!this.page) return;
    try {
      const filename = `${this.debugDir}/${step}.png`;
      await this.page.screenshot({ path: filename, fullPage: true });
      console.log(`📸 Debug screenshot: ${filename}`);
    } catch (e) {
      console.log(`⚠️ Could not save debug screenshot for step ${step}`);
    }
  }

  /**
   * Random delay to appear more human-like
   */
  private randomDelay(min: number, max: number): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return delay(ms);
  }

  /**
   * Launch browser with stealth settings
   */
  async launch(): Promise<void> {
    console.log("🚀 Launching browser...");

    this.browser = await puppeteer.launch({
      headless: this.options.headless,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--window-size=1920,1080",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--disable-infobars",
        "--disable-notifications",
        "--lang=en-US,en",
      ],
      defaultViewport: { width: 1920, height: 1080 },
      ignoreDefaultArgs: ["--enable-automation"],
    });

    this.page = await this.browser.newPage();

    // Set a realistic user agent (Chrome 131 on macOS)
    await this.page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );

    // Set extra HTTP headers
    await this.page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "sec-ch-ua":
        '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
    });

    // Override navigator properties to avoid detection
    await this.page.evaluateOnNewDocument(() => {
      // Hide webdriver
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });

      // Override plugins
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override languages
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en", "he"],
      });

      // Override platform
      Object.defineProperty(navigator, "platform", {
        get: () => "MacIntel",
      });

      // Chrome runtime
      (window as any).chrome = {
        runtime: {},
      };

      // Permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === "notifications"
          ? Promise.resolve({
              state: Notification.permission,
            } as PermissionStatus)
          : originalQuery(parameters);
    });

    console.log("✅ Browser launched");
  }

  /**
   * Step 1: Select system (CTS Israel) on the initial page
   */
  async selectSystem(): Promise<void> {
    if (!this.page) throw new Error("Browser not launched");

    console.log("🌐 Opening Eventim WebReporting...");
    await this.page.goto(this.BASE_URL, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Random human-like delay
    await this.randomDelay(2000, 4000);

    console.log("🔧 Selecting CTS Israel system...");

    // Wait for the System dropdown
    await this.page.waitForSelector("select", { timeout: 10000 });

    // Small delay before interaction
    await this.randomDelay(500, 1000);

    // Find and select CTS Israel in the System dropdown by option text
    const selected = await this.page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll("select"));
      // System is typically the second select (first is Language)
      for (const select of selects) {
        const options = Array.from(select.querySelectorAll("option"));
        for (const option of options) {
          if (option.textContent?.includes("CTS Israel")) {
            (select as HTMLSelectElement).value = option.value;
            // Trigger change event
            select.dispatchEvent(new Event("change", { bubbles: true }));
            return {
              success: true,
              value: option.value,
              text: option.textContent,
            };
          }
        }
      }
      return { success: false, value: "", text: "" };
    });

    console.log(`📋 Selected: ${JSON.stringify(selected)}`);

    if (!selected.success) {
      throw new Error("Could not find CTS Israel option in dropdown");
    }

    await this.randomDelay(1000, 2000);

    // Click Proceed button
    console.log("➡️ Clicking Proceed...");
    await Promise.all([
      this.page.click(
        'input[type="submit"], button[type="submit"], input[value="Proceed"]'
      ),
      this.page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 30000,
      }),
    ]);

    await this.saveDebugScreenshot("1_after_system_select");
    console.log("✅ System selected");
  }

  /**
   * Step 2: Login with Connect-ID credentials
   */
  async login(): Promise<void> {
    if (!this.page) throw new Error("Browser not launched");

    const email = process.env.EVENTIM_DE_LOGIN;
    const password = process.env.EVENTIM_DE_PASSWORD;

    if (!email || !password) {
      throw new Error(
        "EVENTIM_DE_LOGIN and EVENTIM_DE_PASSWORD must be set in .env"
      );
    }

    console.log("🔐 Waiting for login page...");
    await this.randomDelay(3000, 5000);
    await this.saveDebugScreenshot("2_login_page");

    // Check current URL to determine which page we're on
    const currentUrl = this.page.url();
    console.log(`📍 Current URL: ${currentUrl}`);

    // If we're already on the profile page or main page, skip login
    if (
      currentUrl.includes("/netlogin/profile") ||
      currentUrl.includes("STOwnEvents")
    ) {
      console.log("✅ Already logged in, skipping login step");
      return;
    }

    // Wait for the Connect-ID login form
    // The email field might be an input for Connect-ID
    await this.page.waitForSelector('input[type="text"], input[type="email"]', {
      timeout: 15000,
    });

    // Random delay before typing (human behavior)
    await this.randomDelay(500, 1500);

    console.log("📝 Entering credentials...");

    // Find email/username field and enter email
    const emailInput = await this.page.$(
      'input[type="email"], input[type="text"]'
    );
    if (emailInput) {
      await emailInput.click({ clickCount: 1 });
      await this.randomDelay(200, 500);
      // Type with variable delay to appear human
      await emailInput.type(email, { delay: 80 + Math.random() * 50 });
    }

    await this.randomDelay(800, 1500);

    // Find password field
    const passwordInput = await this.page.$('input[type="password"]');
    if (passwordInput) {
      await passwordInput.click();
      await this.randomDelay(200, 400);
      await passwordInput.type(password, { delay: 70 + Math.random() * 40 });
    }

    await this.randomDelay(500, 1000);

    // Click the submit/continue button
    console.log("➡️ Submitting login...");

    // Look for submit button - use page.evaluate to find by text
    const clicked = await this.page.evaluate(() => {
      // Try to find submit button
      const submitBtn = document.querySelector(
        'button[type="submit"], input[type="submit"]'
      ) as HTMLElement;
      if (submitBtn) {
        submitBtn.click();
        return true;
      }

      // Try to find button with text "Continue" or "המשך"
      const buttons = Array.from(document.querySelectorAll("button"));
      const continueBtn = buttons.find(
        (btn) =>
          btn.textContent?.includes("Continue") ||
          btn.textContent?.includes("המשך") ||
          btn.textContent?.includes("המשך")
      );
      if (continueBtn) {
        continueBtn.click();
        return true;
      }

      return false;
    });

    if (clicked) {
      // Wait for navigation or URL change
      try {
        await Promise.race([
          this.page.waitForNavigation({
            waitUntil: "networkidle2",
            timeout: 30000,
          }),
          this.page.waitForFunction(
            () =>
              window.location.href.includes("netlogin/profile") ||
              window.location.href.includes("webreporting/ST"),
            { timeout: 30000 }
          ),
        ]);
      } catch (e) {
        console.log("⚠️ Navigation timeout, checking current state...");
      }
    } else {
      // Try pressing Enter
      await this.page.keyboard.press("Enter");
      try {
        await this.page.waitForNavigation({
          waitUntil: "networkidle2",
          timeout: 30000,
        });
      } catch (e) {
        console.log("⚠️ Enter key navigation timeout");
      }
    }

    await delay(3000);
    await this.saveDebugScreenshot("3_after_login");

    // Check if login was successful
    const afterLoginUrl = this.page.url();
    console.log(`📍 After login URL: ${afterLoginUrl}`);

    if (
      afterLoginUrl.includes("login-actions") ||
      afterLoginUrl.includes("auth/realms")
    ) {
      console.log(
        "⚠️ Still on login page, login may have failed. Taking error screenshot..."
      );
      await this.saveDebugScreenshot("3_login_error");

      // Check for error messages
      const errorMsg = await this.page.evaluate(() => {
        const errorEl = document.querySelector(
          '.alert-error, .error, [class*="error"]'
        );
        return errorEl?.textContent?.trim() || null;
      });
      if (errorMsg) {
        console.log(`❌ Login error: ${errorMsg}`);
      }
    }

    console.log("✅ Login submitted");
  }

  /**
   * Step 3: Select user profile and continue
   */
  async selectProfile(): Promise<void> {
    if (!this.page) throw new Error("Browser not launched");

    console.log("👤 Selecting user profile...");
    await delay(2000);

    // Check current URL
    const currentUrl = this.page.url();
    console.log(`📍 Current URL: ${currentUrl}`);

    // If we're already on the report page, skip profile selection
    if (
      currentUrl.includes("STOwnEvents") ||
      currentUrl.includes("webreporting/ST")
    ) {
      console.log("✅ Already on report page, skipping profile selection");
      return;
    }

    // Wait for profile selection page
    // Look for "Continue to EVENTIM webReporting" button
    try {
      await this.page.waitForSelector('button, a, input[type="submit"]', {
        timeout: 10000,
      });

      // Try to find and click the continue button using evaluate
      const clicked = await this.page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll('button, a, input[type="submit"]')
        );
        const target = buttons.find(
          (btn) =>
            btn.textContent?.includes("Continue to EVENTIM webReporting") ||
            btn.textContent?.includes("Continue")
        );
        if (target) {
          (target as HTMLElement).click();
          return true;
        }
        return false;
      });

      if (!clicked) {
        console.log(
          "⚠️ Continue button not found by text, trying other methods..."
        );
      }

      await this.page
        .waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 })
        .catch(() => {});
      await delay(2000);
    } catch (error) {
      console.log(
        "⚠️ Profile selection might have been skipped or auto-selected"
      );
    }

    await this.saveDebugScreenshot("4_after_profile");
    console.log("✅ Profile selected");
  }

  /**
   * Step 4: Navigate to STOwnEvents and submit the form
   */
  async submitReportForm(): Promise<void> {
    if (!this.page) throw new Error("Browser not launched");

    console.log("📊 Navigating to Own Events report...");

    await this.page.goto(this.REPORT_URL, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await delay(2000);
    await this.saveDebugScreenshot("5_report_form");

    // The form should already have default dates
    console.log("📝 Form loaded with default dates");

    // Click on the client link to expand the events list (e.g., "1555 - בלאקבירדס")
    console.log("🔍 Looking for client link to expand...");

    // Find and click the first link that contains the client info
    const clicked = await this.page.evaluate(() => {
      // Look for links that might be client links (usually starts with a number like "1555 - ")
      const links = Array.from(document.querySelectorAll("a"));
      const clientLink = links.find((link) => {
        const text = link.textContent || "";
        // Match pattern like "1555 - " (number followed by dash)
        return /^\d+\s*-/.test(text.trim());
      });

      if (clientLink) {
        clientLink.click();
        return { success: true, text: clientLink.textContent };
      }
      return { success: false, text: "" };
    });

    if (clicked.success) {
      console.log(`📋 Clicked on client: ${clicked.text}`);
    } else {
      console.log(
        "⚠️ Client link not found, trying to find HTML button directly..."
      );
    }

    await delay(2000);
    await this.saveDebugScreenshot("6_after_client_click");
    console.log("✅ Report form ready");
  }

  /**
   * Step 5: Click on HTML report link and wait for new tab
   */
  async openHtmlReport(): Promise<Page> {
    if (!this.page || !this.browser) throw new Error("Browser not launched");

    console.log("📄 Opening HTML report...");

    // Set up listener for new page/tab before clicking
    const newPagePromise = new Promise<Page>((resolve) => {
      this.browser!.once("targetcreated", async (target) => {
        const newPage = await target.page();
        if (newPage) {
          resolve(newPage);
        }
      });
    });

    // Click the HTML report link
    // selector: #master_content_STR_Html
    await this.page.waitForSelector("#master_content_STR_Html, a.htmlButton", {
      timeout: 10000,
    });
    await this.page.click("#master_content_STR_Html, a.htmlButton");

    // Wait for new tab to open
    const reportPage = (await Promise.race([
      newPagePromise,
      delay(10000).then(() => null),
    ])) as Page | null;

    if (!reportPage) {
      throw new Error("Failed to open report page in new tab");
    }

    // Wait for the report page to load - first table appears
    await reportPage.waitForSelector("table", { timeout: 30000 });

    // Wait for data to load (wait until "Please wait" text disappears or data appears)
    console.log("⏳ Waiting for report data to load...");
    await reportPage.waitForFunction(
      () => {
        const body = document.body.innerText;
        // Wait until loading message disappears
        return !body.includes("Please wait") && !body.includes("fetching data");
      },
      { timeout: 60000 }
    );

    await delay(2000);

    console.log("✅ Report page opened");
    return reportPage;
  }

  /**
   * Step 6: Parse the report table and extract event data
   */
  async parseTable(reportPage: Page): Promise<EventimEvent[]> {
    console.log("📊 Parsing report table...");

    const events = await reportPage.evaluate(() => {
      const results: Array<{
        eventId: string;
        title: string;
        venue: string;
        date: string;
        ticketsSold: { total: number; capacity: number };
      }> = [];

      // Get all table rows
      const allRows = document.querySelectorAll("table tr");

      let currentVenue = "";
      const seenEventIds = new Set<string>();

      allRows.forEach((row: Element) => {
        const rowText = row.textContent || "";
        const cells = row.querySelectorAll("td");

        if (cells.length === 0) return;

        // Check if this is a venue row (single cell with venue pattern)
        // Pattern: "354 - אלמא - מרכז אמנויות"
        if (
          cells.length === 1 ||
          (cells.length > 0 && !rowText.includes("UTC"))
        ) {
          const firstCellText = cells[0]?.textContent?.trim() || "";
          const venueMatch = firstCellText.match(/^(\d+)\s*-\s*(.+)$/);
          if (venueMatch && !firstCellText.includes("UTC")) {
            currentVenue = venueMatch[2].trim();
          }
        }

        // Check if this is an event row (contains UTC timestamp and has enough cells for data)
        if (rowText.includes("(UTC") && cells.length > 5) {
          // Find the event ID - look in first cell with pattern "XXXX - Event Name"
          let eventId = "";
          let title = "";
          let dateStr = "";

          for (let i = 0; i < cells.length; i++) {
            const cellText = cells[i]?.textContent?.trim() || "";

            // Look for event pattern: "8385 - הבלאקבירדס..."
            const eventMatch = cellText.match(/^(\d+)\s*-\s*(.+)/);
            if (eventMatch && cellText.includes("UTC")) {
              eventId = eventMatch[1];

              // Extract title and date from the rest
              const rest = eventMatch[2];
              const utcIndex = rest.indexOf("(UTC");
              const closeParen = rest.indexOf(")", utcIndex);

              if (utcIndex > 0) {
                // Find where date starts (look for Hebrew day names or date patterns)
                const datePatterns = [
                  /יום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי)/,
                  /שבת\s+\d/,
                  /\d{2}\s+(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)/,
                ];

                let dateStartIndex = rest.length;
                for (const pattern of datePatterns) {
                  const match = rest.match(pattern);
                  if (
                    match &&
                    match.index !== undefined &&
                    match.index < dateStartIndex
                  ) {
                    dateStartIndex = match.index;
                  }
                }

                title = rest.substring(0, dateStartIndex).trim();
                dateStr = rest.substring(dateStartIndex, closeParen + 1).trim();
              }
              break;
            }
          }

          if (!eventId) return;

          // Skip duplicates
          if (seenEventIds.has(eventId)) return;

          // Skip rows without a venue (likely header/summary rows)
          if (!currentVenue) return;

          // Extract numbers from cells
          // Typical order: RF, Total Capacity, Kills, Net Capacity, Options, Qty, Value, Qty, Value, Qty, Value, Outlet fee, Total Sales, Available
          const numbers: number[] = [];
          cells.forEach((cell: Element) => {
            const cellText = cell.textContent?.trim() || "";
            // Skip if it contains the event title (has letters/Hebrew)
            if (/[a-zA-Z\u0590-\u05FF]/.test(cellText) && cellText.length > 5)
              return;

            const cleaned = cellText.replace(/,/g, "").trim();
            const num = parseFloat(cleaned);
            if (!isNaN(num)) {
              numbers.push(num);
            }
          });

          // Find capacity, reservations, and sold
          // Capacity is usually at index 1 (Total Capacity)
          // Reservations Quantity is at index 5
          // Available is usually the last number
          let capacity = 0;
          let reservations = 0;
          let available = 0;

          if (numbers.length >= 2) {
            // Total Capacity is typically the second number (after RF which is 0)
            capacity = numbers[1] || 0;
            // Reservations Quantity is at index 5
            reservations = numbers[5] || 0;
            // Available seats is the last number
            available = numbers[numbers.length - 1] || 0;
          }

          const sold = capacity - (available + reservations);

          // Mark this event as seen
          seenEventIds.add(eventId);

          results.push({
            eventId,
            title,
            venue: currentVenue,
            date: dateStr,
            ticketsSold: {
              total: sold > 0 ? sold : 0,
              capacity,
            },
          });
        }
      });

      return results;
    });

    console.log(`✅ Parsed ${events.length} events`);
    events.forEach((e) => {
      console.log(
        `  📌 ${e.eventId}: ${e.ticketsSold.total}/${e.ticketsSold.capacity} sold`
      );
    });

    return events;
  }

  /**
   * Static method: Parse Eventim HTML report from URL
   * This is used for static HTML reports that don't require authentication
   */
  static async parseFromUrl(url: string): Promise<EventimParseResult> {
    console.log(`📄 Fetching HTML report from: ${url}`);

    // Fetch HTML content
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch HTML: ${response.status} ${response.statusText}`);
    }
    const html = await response.text();

    console.log("✅ HTML fetched successfully");

    // Parse with JSDOM
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Extract print time from the HTML
    let printTime: string | undefined;
    const bodyText = document.body.textContent || "";
    const printTimeMatch = bodyText.match(/Print time:\s*(.+?)(?:\n|$)/i);
    if (printTimeMatch) {
      printTime = printTimeMatch[1].trim();
      console.log(`📅 Report print time: ${printTime}`);
    }

    // Parse the table using the same logic as parseTable
    const events: EventimEvent[] = [];
    const allRows = document.querySelectorAll("table tr");

    let currentVenue = "";
    const seenEventIds = new Set<string>();

    allRows.forEach((row: Element) => {
      const rowText = row.textContent || "";
      const cells = row.querySelectorAll("td");

      if (cells.length === 0) return;

      // Check if this is a venue row
      if (
        cells.length === 1 ||
        (cells.length > 0 && !rowText.includes("UTC"))
      ) {
        const firstCellText = cells[0]?.textContent?.trim() || "";
        const venueMatch = firstCellText.match(/^(\d+)\s*-\s*(.+)$/);
        if (venueMatch && !firstCellText.includes("UTC")) {
          currentVenue = venueMatch[2].trim();
        }
      }

      // Check if this is an event row
      if (rowText.includes("(UTC") && cells.length > 5) {
        let eventId = "";
        let title = "";
        let dateStr = "";

        for (let i = 0; i < cells.length; i++) {
          const cellText = cells[i]?.textContent?.trim() || "";

          const eventMatch = cellText.match(/^(\d+)\s*-\s*(.+)/);
          if (eventMatch && cellText.includes("UTC")) {
            eventId = eventMatch[1];

            const rest = eventMatch[2];
            const utcIndex = rest.indexOf("(UTC");
            const closeParen = rest.indexOf(")", utcIndex);

            if (utcIndex > 0) {
              const datePatterns = [
                /יום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי)/,
                /שבת\s+\d/,
                /\d{2}\s+(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)/,
              ];

              let dateStartIndex = rest.length;
              for (const pattern of datePatterns) {
                const match = rest.match(pattern);
                if (
                  match &&
                  match.index !== undefined &&
                  match.index < dateStartIndex
                ) {
                  dateStartIndex = match.index;
                }
              }

              title = rest.substring(0, dateStartIndex).trim();
              dateStr = rest.substring(dateStartIndex, closeParen + 1).trim();
            }
            break;
          }
        }

        if (!eventId) return;
        if (seenEventIds.has(eventId)) return;
        if (!currentVenue) return;

        // Extract numbers from cells
        const numbers: number[] = [];
        cells.forEach((cell: Element) => {
          const cellText = cell.textContent?.trim() || "";
          if (/[a-zA-Z\u0590-\u05FF]/.test(cellText) && cellText.length > 5)
            return;

          const cleaned = cellText.replace(/,/g, "").trim();
          const num = parseFloat(cleaned);
          if (!isNaN(num)) {
            numbers.push(num);
          }
        });

        let capacity = 0;
        let reservations = 0;
        let available = 0;

        if (numbers.length >= 2) {
          capacity = numbers[1] || 0;
          reservations = numbers[5] || 0;
          available = numbers[numbers.length - 1] || 0;
        }

        const sold = capacity - (available + reservations);
        seenEventIds.add(eventId);

        events.push({
          eventId,
          title,
          venue: currentVenue,
          date: dateStr,
          ticketsSold: {
            total: sold > 0 ? sold : 0,
            capacity,
          },
        });
      }
    });

    console.log(`✅ Parsed ${events.length} events from HTML`);
    events.forEach((e) => {
      console.log(
        `  📌 ${e.eventId}: ${e.ticketsSold.total}/${e.ticketsSold.capacity} sold`
      );
    });

    // Save results
    const outputDir = "./output";
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();
    const outputFile = path.join(outputDir, `eventim_static_${timestamp}.json`);

    fs.writeFileSync(outputFile, JSON.stringify(events, null, 2));
    console.log(`💾 Data saved to: ${outputFile}`);

    return {
      events,
      outputFile,
      screenshotPath: "", // No screenshot for static HTML
      timestamp: new Date().toISOString(),
      printTime,
    };
  }

  /**
   * Parse Hebrew date format to Date object
   * Format: "יום ראשון 30 נובמבר 10:23 2025 (UTC+02:00)" or "שבת 29 נובמבר 20:10 2025 (UTC+02:00)"
   */
  private static parseHebrewDate(dateStr: string): Date | null {
    try {
      // Hebrew month names to numbers
      const hebrewMonths: Record<string, number> = {
        'ינואר': 0,
        'פברואר': 1,
        'מרץ': 2,
        'אפריל': 3,
        'מאי': 4,
        'יוני': 5,
        'יולי': 6,
        'אוגוסט': 7,
        'ספטמבר': 8,
        'אוקטובר': 9,
        'נובמבר': 10,
        'דצמבר': 11,
      };

      // Extract components: day number, month name, year, time, timezone
      // Pattern: [Day name] [Day number] [Month name] [Year] [Time] (UTC+Timezone)
      // Example: "יום ראשון 30 נובמבר 2025 10:52 (UTC+02:00)"
      const match = dateStr.match(/(\d+)\s+(\S+)\s+(\d+)\s+(\d+):(\d+)\s+\(UTC([+-]\d+:\d+)\)/);

      if (!match) {
        console.log(`⚠️ Could not parse date format: ${dateStr}`);
        return null;
      }

      const [, day, monthName, year, hours, minutes, timezone] = match;
      const monthNum = hebrewMonths[monthName];

      if (monthNum === undefined) {
        console.log(`⚠️ Unknown Hebrew month: ${monthName}`);
        return null;
      }

      // Parse timezone offset (e.g., "+02:00" -> 2 hours)
      const tzMatch = timezone.match(/([+-])(\d+):(\d+)/);
      if (!tzMatch) {
        console.log(`⚠️ Could not parse timezone: ${timezone}`);
        return null;
      }

      const tzSign = tzMatch[1] === '+' ? 1 : -1;
      const tzHours = parseInt(tzMatch[2], 10);
      const tzMinutes = parseInt(tzMatch[3], 10);
      const tzOffsetMs = tzSign * (tzHours * 60 + tzMinutes) * 60 * 1000;

      // Create date in UTC by adjusting for timezone
      const localDate = new Date(
        parseInt(year, 10),
        monthNum,
        parseInt(day, 10),
        parseInt(hours, 10),
        parseInt(minutes, 10),
        0,
        0
      );

      // Convert to UTC by subtracting the timezone offset
      const utcDate = new Date(localDate.getTime() - tzOffsetMs);

      return utcDate;
    } catch (error) {
      console.log(`⚠️ Error parsing date "${dateStr}":`, error);
      return null;
    }
  }

  /**
   * Check if we should parse this report based on print time
   * Returns null if report is too old, or the last print time if we should parse
   */
  private static checkReportFreshness(printTime?: string): { shouldParse: boolean; reason?: string } {
    if (!printTime) {
      return { shouldParse: true, reason: "No print time found in report" };
    }

    const metadataFile = "./output/eventim_metadata.json";

    // Load existing metadata
    let metadata: { lastPrintTime?: string; lastProcessedAt?: string } = {};
    if (fs.existsSync(metadataFile)) {
      try {
        const content = fs.readFileSync(metadataFile, "utf-8");
        metadata = JSON.parse(content);
      } catch (error) {
        console.log("⚠️ Could not read metadata file, treating as fresh");
      }
    }

    // If no previous print time, this is the first run
    if (!metadata.lastPrintTime) {
      return { shouldParse: true, reason: "First report" };
    }

    // Parse both dates to compare them properly
    const currentDate = this.parseHebrewDate(printTime);
    const lastDate = this.parseHebrewDate(metadata.lastPrintTime);

    // If we can't parse dates, fall back to string comparison (better than nothing)
    if (!currentDate || !lastDate) {
      console.log("⚠️ Could not parse dates, using string comparison as fallback");
      if (printTime <= metadata.lastPrintTime) {
        return {
          shouldParse: false,
          reason: `Report is not newer. Current: ${printTime}, Last: ${metadata.lastPrintTime}`
        };
      }
      return {
        shouldParse: true,
        reason: `Report is newer. Current: ${printTime}, Last: ${metadata.lastPrintTime}`
      };
    }

    // Compare dates properly
    if (currentDate <= lastDate) {
      return {
        shouldParse: false,
        reason: `Report is not newer. Current: ${printTime} (${currentDate.toISOString()}), Last: ${metadata.lastPrintTime} (${lastDate.toISOString()})`
      };
    }

    return {
      shouldParse: true,
      reason: `Report is newer. Current: ${printTime} (${currentDate.toISOString()}), Last: ${metadata.lastPrintTime} (${lastDate.toISOString()})`
    };
  }

  /**
   * Save metadata about the processed report
   */
  private static saveReportMetadata(printTime?: string): void {
    if (!printTime) {
      return;
    }

    const outputDir = "./output";
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const metadataFile = path.join(outputDir, "eventim_metadata.json");
    const metadata = {
      lastPrintTime: printTime,
      lastProcessedAt: new Date().toISOString(),
    };

    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    console.log(`💾 Metadata saved: ${printTime}`);
  }

  /**
   * Parse from URL with freshness check
   * Wrapper around parseFromUrl that checks if report should be processed
   * Returns null if skipped, along with the last print time
   */
  static async parseFromUrlWithCheck(url: string): Promise<{
    result: EventimParseResult | null;
    skipped: boolean;
    currentPrintTime?: string;
    lastPrintTime?: string;
  }> {
    console.log(`📄 Fetching HTML report from: ${url}`);

    // Fetch HTML content
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch HTML: ${response.status} ${response.statusText}`);
    }
    const html = await response.text();

    console.log("✅ HTML fetched successfully");

    // Parse with JSDOM to extract print time first
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Extract print time
    let printTime: string | undefined;
    const bodyText = document.body.textContent || "";
    const printTimeMatch = bodyText.match(/Print time:\s*(.+?)(?:\n|$)/i);
    if (printTimeMatch) {
      printTime = printTimeMatch[1].trim();
      console.log(`📅 Report print time: ${printTime}`);
    }

    // Load last print time from metadata
    const metadataFile = "./output/eventim_metadata.json";
    let lastPrintTime: string | undefined;
    if (fs.existsSync(metadataFile)) {
      try {
        const content = fs.readFileSync(metadataFile, "utf-8");
        const metadata = JSON.parse(content);
        lastPrintTime = metadata.lastPrintTime;
      } catch (error) {
        // Ignore error
      }
    }

    // Check if we should parse
    const freshnessCheck = this.checkReportFreshness(printTime);
    console.log(`🔍 Freshness check: ${freshnessCheck.reason}`);

    if (!freshnessCheck.shouldParse) {
      console.log("⏭️ Skipping parsing - report is not newer");
      return {
        result: null,
        skipped: true,
        currentPrintTime: printTime,
        lastPrintTime,
      };
    }

    // Parse the report
    const result = await this.parseFromUrl(url);

    // Save metadata
    this.saveReportMetadata(printTime);

    return {
      result,
      skipped: false,
      currentPrintTime: printTime,
      lastPrintTime,
    };
  }

  /**
   * Save results to JSON file and take screenshot
   */
  async saveResults(
    reportPage: Page,
    events: EventimEvent[]
  ): Promise<{ outputFile: string; screenshotPath: string }> {
    const outputDir = "./output";
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();
    const outputFile = path.join(outputDir, `eventim_report_${timestamp}.json`);
    const screenshotPath = path.join(
      outputDir,
      `eventim_screenshot_${timestamp}.png`
    );

    // Save JSON
    fs.writeFileSync(outputFile, JSON.stringify(events, null, 2));
    console.log(`💾 Data saved to: ${outputFile}`);

    // Take screenshot
    await reportPage.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved to: ${screenshotPath}`);

    return { outputFile, screenshotPath };
  }

  /**
   * Execute full parsing flow
   */
  async execute(): Promise<EventimParseResult> {
    try {
      // Step 0: Launch browser
      await this.launch();

      // Step 1: Select system
      await this.selectSystem();

      // Step 2: Login
      await this.login();

      // Step 3: Select profile
      await this.selectProfile();

      // Step 4: Submit report form
      await this.submitReportForm();

      // Step 5: Open HTML report
      const reportPage = await this.openHtmlReport();

      // Step 6: Parse table
      const events = await this.parseTable(reportPage);

      // Step 7: Save results
      const { outputFile, screenshotPath } = await this.saveResults(
        reportPage,
        events
      );

      const result: EventimParseResult = {
        events,
        outputFile,
        screenshotPath,
        timestamp: new Date().toISOString(),
      };

      console.log("\n🎉 Parsing completed successfully!");
      console.log(`📊 Total events: ${events.length}`);

      return result;
    } finally {
      if (this.options.closeAfter) {
        await this.close();
      }
    }
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      console.log("🔒 Closing browser...");
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
export default EventimScraper;
