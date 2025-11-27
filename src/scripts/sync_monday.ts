import 'dotenv/config';
import EventsService from '../api/services/events.service';
import MondayService from '../api/services/monday.service';

/**
 * Monday.com Sync Script
 *
 * Reads the latest events file from ./output directory,
 * filters for active events, and updates Monday.com board
 * with capacity, tickets sold, and update timestamp.
 */

async function main() {
    console.log('[MondaySync] Starting Monday.com sync...');
    console.log(`[MondaySync] Timestamp: ${new Date().toISOString()}`);

    try {
        // Initialize services
        const eventsService = EventsService.getInstance();
        const mondayService = MondayService.getInstance();

        // Load latest events
        console.log('[MondaySync] Loading latest events file...');
        const { events, source, parsedAt } = eventsService.getLatestEvents();
        console.log(`[MondaySync] Loaded ${events.length} events from ${source}`);
        console.log(`[MondaySync] File parsed at: ${parsedAt.toISOString()}`);

        // Filter active events
        const activeEvents = events.filter(e => e.active === true);
        console.log(`[MondaySync] Found ${activeEvents.length} active events to sync`);

        if (activeEvents.length === 0) {
            console.log('[MondaySync] No active events to sync. Exiting.');
            process.exit(0);
        }

        // Sync events
        console.log('[MondaySync] Starting sync to Monday.com...');
        console.log(`[MondaySync] Using timestamp: ${parsedAt.toISOString()}`);
        console.log('');

        const result = await mondayService.syncActiveEvents(activeEvents, parsedAt);

        // Log detailed results
        console.log('');
        console.log('[MondaySync] Sync Details:');
        console.log('─'.repeat(60));

        for (const detail of result.details) {
            const eventId = detail.eventId?.padEnd(10) || 'unknown'.padEnd(10);

            switch (detail.status) {
                case 'updated':
                    console.log(`[MondaySync] ✓ ${eventId} - Updated (Item: ${detail.mondayItemId})`);
                    break;
                case 'skipped':
                    console.log(`[MondaySync] ⚠ ${eventId} - Skipped: ${detail.message}`);
                    break;
                case 'error':
                    console.log(`[MondaySync] ✗ ${eventId} - Error: ${detail.message}`);
                    break;
            }
        }

        // Log summary
        console.log('');
        console.log('─'.repeat(60));
        console.log('[MondaySync] Summary:');
        console.log(`  Total Processed:     ${result.totalProcessed}`);
        console.log(`  Successful Updates:  ${result.successfulUpdates}`);
        console.log(`  Skipped:             ${result.skipped}`);
        console.log(`  Errors:              ${result.errors}`);
        console.log('─'.repeat(60));

        // Exit with appropriate status code
        if (result.errors === result.totalProcessed) {
            console.log('[MondaySync] All events failed. Exiting with error code.');
            process.exit(1);
        } else {
            console.log('[MondaySync] Sync completed successfully.');
            process.exit(0);
        }

    } catch (error) {
        console.error('[MondaySync] Fatal error:');
        if (error instanceof Error) {
            console.error(`  Message: ${error.message}`);
            if (error.stack) {
                console.error(`  Stack: ${error.stack}`);
            }
        } else {
            console.error(`  ${error}`);
        }
        process.exit(1);
    }
}

// Run main function
main();
