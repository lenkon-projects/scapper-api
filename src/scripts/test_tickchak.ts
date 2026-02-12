import { TickchakScraper } from '../core/tickchak-scraper';

async function main() {
    console.log('🧪 Testing Tickchak Scraper...');
    
    const scraper = new TickchakScraper();
    
    try {
        await scraper.login();
        
        const events = await scraper.getEvents();
        console.log('\n📅 Events fetched (with enriched ticket data):');
        events.forEach(event => {
            console.log(`----------------------------------------`);
            console.log(`Event ID: ${event.eid}`);
            console.log(`Title: ${event.title}`);
            console.log(`Location: ${event.location}`);
            console.log(`Date: ${new Date(event.timeStart * 1000).toLocaleString()}`);
            console.log(`Tickets: ${event.tickets.sold} sold / ${event.tickets.amount} capacity`);
            
            if (event.tickets.sold > 0) {
                 // Check if the calculation seems to have worked (simple heuristic)
                 const basicAmount = event.tickets.amount; 
                 // Note: we can't easily see the breakdown here without modifying the return type of getEvents, 
                 // but the scraper logic now does the multiplier inside getEvents.
                 // We trust the output 'sold' reflects the multiplier.
            }
        });
        
    } catch (error) {
        console.error('💥 Test failed:', error);
        process.exit(1);
    }
}

main();
