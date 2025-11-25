import { executeParse } from './core/scraper';

async function main(): Promise<void> {
    try {
        const result = await executeParse();

        console.log('📋 Preview of events:');
        result.events.slice(0, 3).forEach((event, index) => {
            console.log(`\n${index + 1}. Event ID: ${event.eventId}`);
            console.log(`   Active: ${event.active ? 'Yes' : 'No'}`);
            if (event.ticketsSold) {
                console.log(`   Total sold: ${event.ticketsSold.total ?? 'N/A'}`);
                console.log(`   Capacity: ${event.ticketsSold.capacity ?? 'N/A'}`);
            } else {
                console.log(`   Tickets: N/A`);
            }
        });

        if (result.events.length > 3) {
            console.log(`\n... and ${result.events.length - 3} more events`);
        }

        console.log('\n✅ Done!');

    } catch (error) {
        console.error('❌ Error:', (error as Error).message);
        process.exit(1);
    }
}

main().catch(console.error);
