import 'dotenv/config';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page, Browser } from 'puppeteer';

puppeteer.use(StealthPlugin());
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

interface HeaderInfo {
    index: number;
    id: string;
    class: string;
    text: string;
}

interface CellInfo {
    index: number;
    class: string;
    text: string;
    hasCheckbox: boolean;
    hasTcControl: boolean;
    hasButton: boolean;
    hasLink: boolean;
}

interface TcControlInfo {
    found: boolean;
    cellIndex: number;
    classes: string;
    eventId: string | null;
    isOn: boolean;
}

async function main(): Promise<void> {
    const browser: Browser = await puppeteer.launch({
        headless: process.env.HEADLESS === 'true',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--disable-blink-features=AutomationControlled', '--window-size=1920,1080', '--no-sandbox', '--disable-dev-shm-usage'],
        defaultViewport: { width: 1920, height: 1080 }
    });

    const page: Page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    try {
        console.log('🌐 Opening login page...');
        await page.goto(process.env.WP_LOGIN_URL!, { waitUntil: 'networkidle2', timeout: 30000 });
        await delay(8000);

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

        console.log('✅ Logged in!\n');
        console.log('📄 Navigating to events page...');
        await page.goto('https://ozentelaviv.com/wp-admin/edit.php?post_type=tc_events', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        await delay(2000);

        console.log('🔍 Analyzing table structure...\n');

        const headers = await page.evaluate((): HeaderInfo[] => {
            const headerCells = document.querySelectorAll('table.wp-list-table thead th');
            return Array.from(headerCells).map((th, index) => ({
                index: index + 1,
                id: th.id || '',
                class: th.className || '',
                text: th.textContent?.trim() || ''
            }));
        });

        console.log('📊 Table Headers:');
        headers.forEach(h => {
            console.log(`  [${h.index}] "${h.text}" (id: ${h.id}, class: ${h.class})`);
        });

        const firstRow = await page.evaluate((): CellInfo[] | null => {
            const firstDataRow = document.querySelector('table.wp-list-table tbody tr:not(.no-items)');
            if (!firstDataRow) return null;

            const cells = firstDataRow.querySelectorAll('td');
            return Array.from(cells).map((td, index) => {
                let text = td.textContent?.trim() || '';
                if (text.length > 100) text = text.substring(0, 100) + '...';

                const hasCheckbox = !!td.querySelector('input[type="checkbox"]');
                const hasTcControl = !!td.querySelector('.tc-control');
                const hasButton = !!td.querySelector('button');
                const hasLink = !!td.querySelector('a');

                return {
                    index: index + 1,
                    class: td.className || '',
                    text: text,
                    hasCheckbox,
                    hasTcControl,
                    hasButton,
                    hasLink
                };
            });
        });

        if (firstRow) {
            console.log('\n📋 First Row Data:');
            firstRow.forEach(cell => {
                const special: string[] = [];
                if (cell.hasCheckbox) special.push('checkbox');
                if (cell.hasTcControl) special.push('tc-control');
                if (cell.hasButton) special.push('button');
                if (cell.hasLink) special.push('link');

                const specialStr = special.length > 0 ? ` [${special.join(', ')}]` : '';
                console.log(`  [${cell.index}] ${specialStr}`);
                console.log(`      Class: ${cell.class}`);
                console.log(`      Text: "${cell.text}"`);
            });
        }

        const tcControlInfo = await page.evaluate((): TcControlInfo | null => {
            const tcControl = document.querySelector('.tc-control');
            if (!tcControl) return null;

            const td = tcControl.closest('td');
            const tr = tcControl.closest('tr');
            const allTds = tr ? Array.from(tr.querySelectorAll('td')) : [];
            const cellIndex = td ? allTds.indexOf(td) + 1 : 0;

            return {
                found: true,
                cellIndex,
                classes: tcControl.className,
                eventId: tcControl.getAttribute('event_id'),
                isOn: tcControl.classList.contains('tc-on')
            };
        });

        if (tcControlInfo && tcControlInfo.found) {
            console.log('\n🎯 TC-Control found:');
            console.log(`  Cell index: ${tcControlInfo.cellIndex}`);
            console.log(`  Classes: ${tcControlInfo.classes}`);
            console.log(`  Event ID: ${tcControlInfo.eventId}`);
            console.log(`  Is ON: ${tcControlInfo.isOn}`);
        } else {
            console.log('\n⚠️ TC-Control NOT found!');
        }

        if (process.env.CLOSE_BROWSER !== 'false') {
            await browser.close();
        } else {
            console.log('\n⚠️ Browser left open (CLOSE_BROWSER=false)');
            await new Promise(() => {});
        }

    } catch (error) {
        console.error('❌ Error:', (error as Error).message);
        await page.screenshot({ path: 'debug_error.png' });
        if (process.env.CLOSE_BROWSER !== 'false') {
            await browser.close();
        }
    }
}

main().catch(console.error);
