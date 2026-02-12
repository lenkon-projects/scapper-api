import 'dotenv/config';
import { 
    TickchakLoginResponse, 
    TickchakEvent, 
    TickchakEventsResponse,
    TickchakTicketResponse,
    TickchakTicketType
} from './tickchak.types';

export class TickchakScraper {
    private readonly LOGIN_URL = 'https://app.tickchak.co.il/user/login/';
    private readonly EVENTS_URL = 'https://app.tickchak.co.il/v1/events/';
    private readonly SINGLE_EVENT_URL = 'https://app.tickchak.co.il/v1/event/'; // + {eid}/tickets
    
    private token: string | null = null;
    private userId: number | null = null;

    async login(): Promise<void> {
        const email = process.env.TICKCHAK_EMAIL;
        const password = process.env.TICKCHAK_PASSWORD;

        if (!email || !password) {
            throw new Error('TICKCHAK_EMAIL and TICKCHAK_PASSWORD must be set in .env');
        }

        console.log(`🔐 Logging in to Tickchak as ${email}...`);

        try {
            const response = await fetch(this.LOGIN_URL, {
                method: 'POST',
                headers: {
                    'accept': 'application/json, text/plain, */*',
                    'content-type': 'application/json',
                    'origin': 'https://app.tickchak.co.il',
                    'referer': 'https://app.tickchak.co.il/login',
                    'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
                },
                body: JSON.stringify({
                    email,
                    password,
                    isLoginByPassword: true,
                    handleError: true
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Login failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json() as TickchakLoginResponse;
            
            if (!data.tickchak_user_production) {
                console.error('Login response:', data);
                throw new Error('Login failed: No token received in response');
            }

            this.token = data.tickchak_user_production;
            this.userId = data.user.globalUserId;
            
            console.log('✅ Logged in successfully!');
            console.log(`👤 User: ${data.user.firstName} ${data.user.lastName} (ID: ${this.userId})`);
            
        } catch (error) {
            console.error('❌ Login Error:', error);
            throw error;
        }
    }

    async getEventTickets(eid: number): Promise<TickchakTicketType[]> {
        if (!this.token || !this.userId) {
            throw new Error('Not logged in. Call login() first.');
        }

        const url = `${this.SINGLE_EVENT_URL}${eid}/tickets?limit=20&offset=0`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'accept': 'application/json, text/plain, */*',
                    'accept-language': 'ru-RU,ru;q=0.9,he-IL;q=0.8,he;q=0.7,en-GB;q=0.6,en;q=0.5,en-US;q=0.4',
                    'cache-control': 'no-cache',
                    'pragma': 'no-cache',
                    'priority': 'u=1, i',
                    'referer': `https://app.tickchak.co.il/e/${eid}/tickets`,
                    'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"macOS"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
                    'x-local-user-id': this.userId.toString(),
                    'Cookie': `tickchak_user_production=${this.token}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch tickets for event ${eid}: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json() as TickchakTicketResponse;
            return data.ticketsInfo || [];

        } catch (error) {
            console.error(`❌ Get Event Tickets Error for ${eid}:`, error);
            return [];
        }
    }

    async getEvents(): Promise<TickchakEvent[]> {
        if (!this.token || !this.userId) {
            throw new Error('Not logged in. Call login() first.');
        }

        console.log(`📊 Fetching events...`);

        const queryParams = new URLSearchParams({
            search: '',
            limit: '10',
            offset: '0',
            type: 'active'
        });

        const url = `${this.EVENTS_URL}?${queryParams.toString()}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'accept': 'application/json, text/plain, */*',
                    'accept-language': 'ru-RU,ru;q=0.9,he-IL;q=0.8,he;q=0.7,en-GB;q=0.6,en;q=0.5,en-US;q=0.4',
                    'cache-control': 'no-cache',
                    'pragma': 'no-cache',
                    'priority': 'u=1, i',
                    'referer': 'https://app.tickchak.co.il/',
                    'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"macOS"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
                    'x-local-user-id': this.userId.toString(),
                    'Cookie': `tickchak_user_production=${this.token}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch events: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json() as TickchakEventsResponse;
            
            if (!data.events) {
                console.warn('⚠️ No events found in response:', data);
                return [];
            }

            console.log(`✅ Found ${data.events.length} events`);
            
            // Enrich events with precise ticket data
            const enrichedEvents = await Promise.all(data.events.map(async (event) => {
                const ticketsInfo = await this.getEventTickets(event.eid);
                
                let totalSold = 0;
                let totalCapacity = 0;

                ticketsInfo.forEach(ticket => {
                    // Check if it's a "double ticket" (e.g. "כרטיס זוגי")
                    // Note: "כרטיס זוגי" means "Couple Ticket" in Hebrew
                    const isDouble = ticket.title.includes('זוגי');
                    const multiplier = isDouble ? 2 : 1;
                    
                    totalSold += ticket.sold * multiplier;
                    
                    // Capacity is usually just the amount, but active tickets also have a 'limit'
                    // The 'amount' seems to be the total allocation
                    totalCapacity += ticket.amount * multiplier;
                });
                
                // If we found ticket info, override the basic summary
                if (ticketsInfo.length > 0) {
                    event.tickets = {
                        ...event.tickets,
                        sold: totalSold,
                        amount: totalCapacity
                    };
                }

                return event;
            }));

            return enrichedEvents;

        } catch (error) {
            console.error('❌ Get Events Error:', error);
            throw error;
        }
    }
    
    getToken(): string | null {
        return this.token;
    }
}
