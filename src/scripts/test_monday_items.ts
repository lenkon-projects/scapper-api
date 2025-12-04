import 'dotenv/config';
import axios, { AxiosInstance } from 'axios';

/**
 * Test Monday.com Items Script
 *
 * Retrieves all items from Monday.com board and displays their event IDs.
 * Useful for debugging which events exist in Monday.com.
 */

interface MondayConfig {
    apiKey: string;
    boardId: string;
    apiUrl: string;
    eventIdColumn: string;
}

interface ColumnValue {
    id: string;
    text?: string;
    value?: string;
}

interface MondayItemDetailed {
    id: string;
    name: string;
    column_values: ColumnValue[];
}

interface BoardItemsResponse {
    boards: Array<{
        items_page: {
            cursor?: string;
            items: MondayItemDetailed[];
        };
    }>;
}

async function main() {
    console.log('[TestMondayItems] Starting Monday.com items retrieval...');
    console.log(`[TestMondayItems] Timestamp: ${new Date().toISOString()}`);
    console.log('');

    try {
        // Load config
        const config: MondayConfig = {
            apiKey: process.env.MONDAY_COM_API_KEY || '',
            boardId: process.env.MONDAY_COM_BOARD_ID || '5086703491',
            apiUrl: process.env.MONDAY_COM_API_URL || 'https://api.monday.com/v2',
            eventIdColumn: process.env.MONDAY_COM_EVENT_ID_COLUMN || 'text_mkxy6ra8'
        };

        if (!config.apiKey) {
            throw new Error('Missing required environment variable: MONDAY_COM_API_KEY');
        }

        console.log(`[TestMondayItems] Board ID: ${config.boardId}`);
        console.log(`[TestMondayItems] Event ID Column: ${config.eventIdColumn}`);
        console.log('');

        // Create axios client
        const client: AxiosInstance = axios.create({
            baseURL: config.apiUrl,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': config.apiKey,
                'API-Version': '2025-07'
            }
        });

        // Query to get all items with column values
        const query = `
            query GetAllItems($boardId: ID!) {
                boards(ids: [$boardId]) {
                    items_page(limit: 500) {
                        cursor
                        items {
                            id
                            name
                            column_values {
                                id
                                text
                                value
                            }
                        }
                    }
                }
            }
        `;

        const variables = {
            boardId: config.boardId
        };

        console.log('[TestMondayItems] Fetching items from Monday.com...');
        const response = await client.post<{ data: BoardItemsResponse }>('', {
            query,
            variables
        });

        if (!response.data.data.boards || response.data.data.boards.length === 0) {
            console.log('[TestMondayItems] Board not found or empty.');
            process.exit(0);
        }

        const items = response.data.data.boards[0].items_page.items;
        console.log(`[TestMondayItems] Found ${items.length} items on the board`);
        console.log('');

        // Display items with event IDs
        console.log('[TestMondayItems] Items List:');
        console.log('─'.repeat(80));
        console.log('Monday ID'.padEnd(15) + 'Event ID'.padEnd(20) + 'Name');
        console.log('─'.repeat(80));

        for (const item of items) {
            // Find the event ID column value
            const eventIdColumn = item.column_values.find(cv => cv.id === config.eventIdColumn);
            const eventId = eventIdColumn?.text || eventIdColumn?.value || 'N/A';

            // Find Update Date column
            const updateDateColumn = item.column_values.find(cv => cv.id === 'date_mky2adca');

            console.log(
                item.id.padEnd(15) +
                eventId.padEnd(20) +
                item.name.substring(0, 30).padEnd(32) +
                (updateDateColumn?.text || 'No Update Date')
            );
        }

        console.log('─'.repeat(80));
        console.log('');
        console.log(`[TestMondayItems] Total items: ${items.length}`);
        console.log('');

        // Show detailed column structure for an item with Update Date
        const itemWithUpdateDate = items.find(item => {
            const updateDateCol = item.column_values.find(cv => cv.id === 'date_mky2adca');
            return updateDateCol?.text && updateDateCol.text !== 'N/A';
        });

        if (itemWithUpdateDate) {
            console.log('[TestMondayItems] Sample Item with Update Date:');
            console.log('─'.repeat(80));
            console.log(`Item: ${itemWithUpdateDate.name} (ID: ${itemWithUpdateDate.id})`);
            console.log('');

            const updateDateCol = itemWithUpdateDate.column_values.find(cv => cv.id === 'date_mky2adca');
            if (updateDateCol) {
                console.log('Update Date Column (date_mky2adca):');
                console.log(`  Text: ${updateDateCol.text || 'N/A'}`);
                console.log(`  Value: ${updateDateCol.value || 'N/A'}`);
                console.log('');

                // Try to parse the value JSON
                if (updateDateCol.value) {
                    try {
                        const parsed = JSON.parse(updateDateCol.value);
                        console.log('  Parsed Value:');
                        console.log(`    date: ${parsed.date || 'N/A'}`);
                        console.log(`    time: ${parsed.time || 'N/A'}`);
                        console.log(`    changed_at: ${parsed.changed_at || 'N/A'}`);
                    } catch (e) {
                        console.log('  Could not parse value as JSON');
                    }
                }
            }
            console.log('─'.repeat(80));
            console.log('');
        }

        // Count items with event IDs
        const itemsWithEventIds = items.filter(item => {
            const eventIdColumn = item.column_values.find(cv => cv.id === config.eventIdColumn);
            const eventId = eventIdColumn?.text || eventIdColumn?.value;
            return eventId && eventId !== 'N/A' && eventId.trim() !== '';
        });

        console.log(`[TestMondayItems] Items with Event IDs: ${itemsWithEventIds.length}`);
        console.log('');

        // Extract just event IDs for easy comparison
        console.log('[TestMondayItems] Event IDs in Monday.com:');
        console.log('─'.repeat(60));

        const eventIds: string[] = [];
        for (const item of items) {
            const eventIdColumn = item.column_values.find(cv => cv.id === config.eventIdColumn);
            const eventId = eventIdColumn?.text || eventIdColumn?.value;
            if (eventId && eventId !== 'N/A' && eventId.trim() !== '') {
                eventIds.push(eventId);
                console.log(`  ${eventId}`);
            }
        }

        console.log('─'.repeat(60));
        console.log('');
        console.log('[TestMondayItems] Completed successfully.');
        process.exit(0);

    } catch (error) {
        console.error('[TestMondayItems] Fatal error:');
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

main();
