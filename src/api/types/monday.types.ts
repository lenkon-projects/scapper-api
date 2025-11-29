export interface MondayApiResponse<T> {
    data: T;
    errors?: Array<{ message: string; locations?: any[]; path?: string[] }>;
    account_id?: number;
}

export interface MondayItem {
    id: string;
    name: string;
}

export interface MondayColumnValue {
    id: string;
    text?: string;
    value?: string;
}

export interface MondayItemWithColumns {
    id: string;
    name: string;
    column_values: MondayColumnValue[];
}

export interface ItemsSearchResponse {
    items_page_by_column_values: {
        cursor?: string;
        items: MondayItem[];
    };
}

export interface BoardItemsResponse {
    boards: Array<{
        items_page: {
            cursor?: string;
            items: MondayItemWithColumns[];
        };
    }>;
}

export interface ChangeMultipleColumnValuesResponse {
    change_multiple_column_values: {
        id: string;
    };
}

export interface SyncDetail {
    eventId: string;
    status: 'updated' | 'skipped' | 'error';
    message?: string;
    mondayItemId?: string;
}

export interface SyncResult {
    totalProcessed: number;
    successfulUpdates: number;
    skipped: number;
    errors: number;
    details: SyncDetail[];
}

export interface MondayConfig {
    apiKey: string;
    boardId: string;
    apiUrl: string;
    timeout: number;
    eventIdColumn: string;
    capacityColumn: string;
    ticketsSoldColumn: string;
    updateDateColumn: string;
}
