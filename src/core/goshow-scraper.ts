import "dotenv/config";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Page, Browser } from "puppeteer";
import * as fs from "fs";
import * as path from "path";
import {
  GoShowParseOptions,
  GoShowParseResult,
  GoShowEvent,
} from "./goshow.types";
import { delay } from "./utils";

puppeteer.use(StealthPlugin());

/**
 * GoShowScraper - Parser for manager.goshow.co.il backstage system
 *
 * Flow:
 * 1. Login to GoShow Manager
 * 2. Navigate to backstage dashboard
 * 3. Parse events table
 * 4. Extract event data (ID, tickets sold, capacity)
 */
export class GoShowScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private options: GoShowParseOptions;
  private debugDir = "./output/debug";

  private readonly LOGIN_URL =
    "https://manager.goshow.co.il/backstage/system/login";
  private readonly DASHBOARD_URL = "https://manager.goshow.co.il/backstage";

  constructor(options: GoShowParseOptions = {}) {
    this.options = {
      headless: options.headless ?? process.env.HEADLESS === "true",
      closeAfter: options.closeAfter ?? process.env.CLOSE_BROWSER !== "false",
    };

    // Clean up before starting
    this.cleanupDebugDir();
    this.cleanupOldReports();

    // Ensure debug directory exists
    if (!fs.existsSync(this.debugDir)) {
      fs.mkdirSync(this.debugDir, { recursive: true });
    }
  }

  /**
   * Clean up debug directory
   */
  private cleanupDebugDir(): void {
    if (fs.existsSync(this.debugDir)) {
      const files = fs.readdirSync(this.debugDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.debugDir, file));
      }
      console.log(`🧹 Cleaned debug directory (${files.length} files removed)`);
    }
  }

  /**
   * Clean up old reports and screenshots, keeping only the latest one
   */
  private cleanupOldReports(): void {
    const outputDir = "./output";
    if (!fs.existsSync(outputDir)) return;

    const files = fs.readdirSync(outputDir);

    // Get goshow reports and screenshots
    const reports = files
      .filter((f) => f.startsWith("goshow_report_") && f.endsWith(".json"))
      .map((f) => ({
        name: f,
        time: fs.statSync(path.join(outputDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time);

    const screenshots = files
      .filter((f) => f.startsWith("goshow_screenshot_") && f.endsWith(".png"))
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
      const filename = `${this.debugDir}/step_${step}_${Date.now()}.png`;
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
        "--lang=he-IL,he,en-US,en", // Hebrew first for GoShow
      ],
      defaultViewport: { width: 1920, height: 1080 },
      ignoreDefaultArgs: ["--enable-automation"],
    });

    this.page = await this.browser.newPage();

    // Set realistic user agent
    await this.page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );

    // Set extra HTTP headers
    await this.page.setExtraHTTPHeaders({
      "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "sec-ch-ua":
        '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
    });

    // Override navigator properties
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });
      Object.defineProperty(navigator, "languages", {
        get: () => ["he-IL", "he", "en-US", "en"],
      });
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
   * Login to GoShow Manager
   */
  async login(): Promise<void> {
    if (!this.page) throw new Error("Browser not launched");

    const email = process.env.GO_SHOW_USER;
    const password = process.env.GO_SHOW_PASSWORD;

    if (!email || !password) {
      throw new Error("GO_SHOW_USER and GO_SHOW_PASSWORD must be set in .env");
    }

    console.log("🔐 Navigating to GoShow login page...");
    await this.page.goto(this.LOGIN_URL, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await this.randomDelay(2000, 4000);
    await this.saveDebugScreenshot("1_login_page");

    console.log("📝 Entering credentials...");

    // Wait for login form to be visible
    await this.page.waitForSelector(
      'input[type="email"], input[type="text"], input[name*="email"]',
      {
        timeout: 15000,
      }
    );

    await this.randomDelay(500, 1500);

    // Find and fill email field
    const emailInput = await this.page.$(
      'input[type="email"], input[type="text"], input[name*="email"], input[placeholder*="דוא״ל"]'
    );

    if (emailInput) {
      await emailInput.click({ clickCount: 1 });
      await this.randomDelay(200, 500);
      await emailInput.type(email, { delay: 80 + Math.random() * 50 });
    } else {
      throw new Error("Email input field not found");
    }

    await this.randomDelay(800, 1500);

    // Find and fill password field
    const passwordInput = await this.page.$(
      'input[type="password"], input[name*="password"], input[placeholder*="סיסמה"]'
    );

    if (passwordInput) {
      await passwordInput.click();
      await this.randomDelay(200, 400);
      await passwordInput.type(password, { delay: 70 + Math.random() * 40 });
    } else {
      throw new Error("Password input field not found");
    }

    await this.randomDelay(500, 1000);
    await this.saveDebugScreenshot("2_credentials_entered");

    console.log("➡️ Submitting login...");

    // Submit the form
    const submitted = await this.page.evaluate(() => {
      const submitBtn = document.querySelector(
        'button[type="submit"], input[type="submit"], button.submit, .submit-button'
      ) as HTMLElement;

      if (submitBtn) {
        submitBtn.click();
        return true;
      }

      // Fallback: try finding button with Hebrew text
      const buttons = Array.from(document.querySelectorAll("button"));
      const loginBtn = buttons.find(
        (btn) =>
          btn.textContent?.includes("כניסה") ||
          btn.textContent?.includes("התחבר")
      );

      if (loginBtn) {
        (loginBtn as HTMLElement).click();
        return true;
      }

      return false;
    });

    if (submitted) {
      // Wait for navigation
      try {
        await this.page.waitForNavigation({
          waitUntil: "networkidle2",
          timeout: 30000,
        });
      } catch (e) {
        console.log("⚠️ Navigation timeout, checking current state...");
      }
    } else {
      // Fallback: press Enter
      await this.page.keyboard.press("Enter");
      await this.page
        .waitForNavigation({
          waitUntil: "networkidle2",
          timeout: 30000,
        })
        .catch(() => {});
    }

    await this.randomDelay(2000, 3000);
    await this.saveDebugScreenshot("3_after_login");

    // Verify login success
    const currentUrl = this.page.url();
    console.log(`📍 After login URL: ${currentUrl}`);

    if (currentUrl.includes("login")) {
      console.log("⚠️ Still on login page, login may have failed");

      // Check for error messages
      const errorMsg = await this.page.evaluate(() => {
        const errorEl = document.querySelector(
          '.alert, .error, [class*="error"], .message'
        );
        return errorEl?.textContent?.trim() || null;
      });

      if (errorMsg) {
        throw new Error(`Login failed: ${errorMsg}`);
      }
    }

    console.log("✅ Login successful");
  }

  /**
   * Navigate to dashboard
   */
  async navigateToDashboard(): Promise<void> {
    if (!this.page) throw new Error("Browser not launched");

    console.log("📊 Navigating to dashboard...");

    const currentUrl = this.page.url();

    // If not on dashboard, navigate to it
    if (!currentUrl.includes("/backstage") || currentUrl.includes("login")) {
      await this.page.goto(this.DASHBOARD_URL, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
    }

    await this.randomDelay(2000, 3000);
    await this.saveDebugScreenshot("4_dashboard_initial");

    // Click on "אירועים ששותפו איתי" tab to show events table
    console.log("🔍 Looking for shared events tab...");

    const tabClicked = await this.page.evaluate(() => {
      // Find the tab by text content or attribute
      const tabs = document.querySelectorAll('li[tab], li.tab, li[class*="tab"]');
      for (const tab of tabs) {
        const tabText = tab.textContent?.trim() || "";
        const tabAttr = tab.getAttribute("tab") || "";

        if (
          tabText.includes("אירועים ששותפו איתי") ||
          tabAttr === "tab-shared-main"
        ) {
          (tab as HTMLElement).click();
          return true;
        }
      }
      return false;
    });

    if (!tabClicked) {
      console.log("⚠️ Tab not found, trying alternative selectors...");

      // Alternative: try clicking by specific selector
      try {
        await this.page.click('li[tab="tab-shared-main"]');
        console.log("✅ Clicked tab using direct selector");
      } catch (e) {
        console.log("⚠️ Could not find shared events tab, continuing anyway...");
      }
    } else {
      console.log("✅ Clicked on shared events tab");
    }

    await this.randomDelay(1000, 2000);

    // Wait for the table to appear
    try {
      await this.page.waitForSelector("table", { timeout: 15000 });
      console.log("✅ Events table loaded");
    } catch (e) {
      console.log("⚠️ Table not found immediately, taking screenshot for debug");
    }

    await this.saveDebugScreenshot("4_dashboard_with_table");
    console.log("✅ Dashboard loaded");
  }

  /**
   * Parse events from dashboard
   */
  async parseTable(): Promise<GoShowEvent[]> {
    if (!this.page) throw new Error("Browser not launched");

    console.log("📊 Parsing events...");

    const events = await this.page.evaluate(() => {
      const results: Array<{
        eventId: string;
        title?: string;
        venue?: string;
        date?: string;
        ticketsSold: { total: number; capacity: number };
      }> = [];

      // Find the show list container
      const showListContainer = document.querySelector(
        'div.show_list.tab-shared-main, div.show_list[style*="display: block"]'
      );

      if (!showListContainer) {
        console.error("Show list container not found");
        return results;
      }

      console.log("Found show list container");

      // Get all show divs
      const showDivs = showListContainer.querySelectorAll("div.show");
      console.log(`Found ${showDivs.length} show divs`);

      const seenEventIds = new Set<string>();

      showDivs.forEach((showDiv, index) => {
        try {
          // Extract event ID from details link
          const detailsLink = showDiv.querySelector(
            'a[href*="/backstage/shows/view/"]'
          );
          if (!detailsLink) {
            console.log(`Show ${index}: No details link found`);
            return;
          }

          const href = detailsLink.getAttribute("href") || "";
          const match = href.match(/\/shows\/view\/(\d+)/);
          if (!match) {
            console.log(`Show ${index}: Could not extract event ID from ${href}`);
            return;
          }

          const eventId = match[1];

          // Skip duplicates
          if (seenEventIds.has(eventId)) {
            console.log(`Show ${index}: Duplicate event ID ${eventId}`);
            return;
          }

          // Extract title
          let title: string | undefined;
          const titleEl = showDiv.querySelector("h4.show_title");
          if (titleEl) {
            title = titleEl.textContent?.trim();
          }

          // Extract venue
          let venue: string | undefined;
          const venueEl = showDiv.querySelector("p.place");
          if (venueEl) {
            venue = venueEl.textContent?.trim();
          }

          // Extract date
          let date: string | undefined;
          const placeElements = showDiv.querySelectorAll("p.place");
          if (placeElements.length > 1) {
            const dateSpan = placeElements[1].querySelector("span");
            if (dateSpan) {
              date = dateSpan.textContent?.trim();
            }
          }

          // Find the table with ticket data
          const table = showDiv.querySelector("table");
          if (!table) {
            console.log(`Show ${index}: No table found`);
            return;
          }

          // Find header indices
          let capacityIndex = -1;
          let soldIndex = -1;

          const headerRow = table.querySelector("thead tr");
          if (headerRow) {
            const headers = headerRow.querySelectorAll("th");
            headers.forEach((header, idx) => {
              const headerText = header.textContent?.trim() || "";
              if (headerText.includes("הוקצו למכירה")) {
                capacityIndex = idx;
              } else if (headerText.includes("נמכרו דרך האתר")) {
                soldIndex = idx;
              }
            });
          }

          console.log(
            `Show ${index}: capacityIndex=${capacityIndex}, soldIndex=${soldIndex}`
          );

          // Extract data from tbody
          let capacity = 0;
          let sold = 0;

          const dataRow = table.querySelector("tbody tr");
          if (dataRow) {
            const cells = dataRow.querySelectorAll("td");

            if (capacityIndex >= 0 && cells[capacityIndex]) {
              const capacityText =
                cells[capacityIndex].textContent?.trim() || "0";
              capacity = parseInt(capacityText.replace(/,/g, ""), 10) || 0;
            }

            if (soldIndex >= 0 && cells[soldIndex]) {
              const soldText = cells[soldIndex].textContent?.trim() || "0";
              sold = parseInt(soldText.replace(/,/g, ""), 10) || 0;
            }
          }

          console.log(
            `Show ${index}: eventId=${eventId}, capacity=${capacity}, sold=${sold}`
          );

          seenEventIds.add(eventId);

          results.push({
            eventId,
            title,
            venue,
            date,
            ticketsSold: {
              total: sold,
              capacity,
            },
          });
        } catch (error) {
          console.error(`Error parsing show ${index}:`, error);
        }
      });

      return results;
    });

    console.log(`✅ Parsed ${events.length} events`);
    events.forEach((e) => {
      console.log(
        `  📌 ${e.eventId}: ${e.ticketsSold.total}/${e.ticketsSold.capacity} sold`
      );
      if (e.title) console.log(`     Title: ${e.title.substring(0, 50)}...`);
      if (e.venue) console.log(`     Venue: ${e.venue}`);
      if (e.date) console.log(`     Date: ${e.date}`);
    });

    return events;
  }

  /**
   * Save results to JSON and screenshot
   */
  async saveResults(
    events: GoShowEvent[]
  ): Promise<{ outputFile: string; screenshotPath: string }> {
    if (!this.page) throw new Error("Browser not launched");

    const outputDir = "./output";
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();
    const outputFile = path.join(outputDir, `goshow_report_${timestamp}.json`);
    const screenshotPath = path.join(
      outputDir,
      `goshow_screenshot_${timestamp}.png`
    );

    // Save JSON
    fs.writeFileSync(outputFile, JSON.stringify(events, null, 2));
    console.log(`💾 Data saved to: ${outputFile}`);

    // Take screenshot
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved to: ${screenshotPath}`);

    return { outputFile, screenshotPath };
  }

  /**
   * Execute full parsing workflow
   */
  async execute(): Promise<GoShowParseResult> {
    try {
      // Step 0: Launch browser
      await this.launch();

      // Step 1: Login
      await this.login();

      // Step 2: Navigate to dashboard
      await this.navigateToDashboard();

      // Step 3: Parse table
      const events = await this.parseTable();

      // Step 4: Save results
      const { outputFile, screenshotPath } = await this.saveResults(events);

      const result: GoShowParseResult = {
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
   * Close browser and cleanup
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log("🔒 Browser closed");
    }
  }
}
