import 'dotenv/config';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page, Browser } from 'puppeteer';
import * as fs from 'fs';
import { Event, ParseOptions, ParseResult } from './types';
import { delay } from './utils';

puppeteer.use(StealthPlugin());

async function parseEventsTable(page: Page): Promise<Event[]> {
    console.log('📊 Parsing events table...');

    const events = await page.evaluate((): Event[] => {
        const rows = document.querySelectorAll('table.wp-list-table tbody tr');
        const eventsData: Event[] = [];

        rows.forEach(row => {
            if (row.classList.contains('no-items')) return;

            const event: Event = {};

            const activeEl = row.querySelector('td.column-event_active .tc-control');
            if (activeEl) {
                event.active = activeEl.classList.contains('tc-on');
                const eventId = activeEl.getAttribute('event_id');
                if (eventId) {
                    event.eventId = eventId;
                }
            }

            const ticketsEl = row.querySelector('td.column-tickets_sold');
            if (ticketsEl) {
                const text = ticketsEl.textContent?.trim() || '';

                const ticketData: any = {};

                const totalMatch = text.match(/מכירות קודמות\s*:\s*(\d+)/);
                if (totalMatch) {
                    ticketData.total = parseInt(totalMatch[1]);
                }

                const capacityMatch = text.match(/מלאי מקורי\s*:\s*(\d+)/);
                if (capacityMatch) {
                    ticketData.capacity = parseInt(capacityMatch[1]);
                }

                event.ticketsSold = ticketData;
            }

            if (event.eventId) {
                eventsData.push(event);
            }
        });

        return eventsData;
    });

    console.log(`✅ Found ${events.length} events`);
    return events;
}

export async function executeParse(options: ParseOptions = {}): Promise<ParseResult> {
    const headless = options.headless ?? (process.env.HEADLESS === 'true');
    const closeAfter = options.closeAfter ?? (process.env.CLOSE_BROWSER !== 'false');

    const browser: Browser = await puppeteer.launch({
        headless,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions'
        ],
        defaultViewport: { width: 1920, height: 1080 },
        ignoreDefaultArgs: ['--disable-extensions']
    });

    const page: Page = await browser.newPage();

    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    try {
        console.log('🌐 Opening login page...');
        await page.goto(process.env.WP_LOGIN_URL!, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        console.log('⏳ Waiting for protection...');
        await delay(8000);

        try {
            await page.waitForFunction(
                () => {
                    const text = document.body.innerText;
                    return !text.includes('Verifying Connection');
                },
                { timeout: 20000 }
            );
        } catch (e) {
            console.log('⚠️ Protection timeout, continuing...');
        }

        console.log('🔐 Logging in...');
        await page.waitForSelector('#user_login', { timeout: 10000 });
        await page.type('#user_login', process.env.WP_USERNAME!, { delay: 100 });
        await delay(500);
        await page.type('#user_pass', process.env.WP_PASSWORD!, { delay: 100 });
        await delay(500);

        await Promise.all([
            page.click('#wp-submit'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);

        console.log('✅ Logged in successfully!\n');

        console.log('📄 Navigating to events page...');
        await page.goto('https://ozentelaviv.com/wp-admin/edit.php?post_type=tc_events', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        await delay(2000);

        const events = await parseEventsTable(page);

        const outputDir = './output';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const timestamp = Date.now();
        const filename = `${outputDir}/events_${timestamp}.json`;
        const screenshotPath = `${outputDir}/events_screenshot.png`;

        fs.writeFileSync(filename, JSON.stringify(events, null, 2), 'utf-8');

        console.log(`\n💾 Data saved to: ${filename}`);
        console.log(`📊 Total events: ${events.length}`);

        await page.screenshot({
            path: screenshotPath,
            fullPage: true
        });

        console.log('📸 Screenshot saved\n');

        if (closeAfter) {
            await browser.close();
            console.log('✅ Browser closed');
        }

        return {
            events,
            outputFile: `events_${timestamp}.json`,
            screenshotPath: 'events_screenshot.png'
        };

    } catch (error) {
        console.error('❌ Error:', (error as Error).message);
        await page.screenshot({ path: 'error_screenshot.png' });

        if (closeAfter) {
            await browser.close();
        }

        throw error;
    }
}
