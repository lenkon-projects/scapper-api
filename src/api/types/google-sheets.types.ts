export interface GoogleSheetsConfig {
    spreadsheetId: string;
    sheetName: string;
    credentialsPath: string;
}

export interface SheetRow {
    rowIndex: number; // 1-based row number in the sheet (2 = first data row)
    bandName: string;
    eventId: string;
    eventDate: string;
    eventFullNameEng: string;
    capacity: number;
    totalTicketsSold: number;
    lastSnapshotAt: string;
    unixTimestamp?: number;
    eventStatus: string;
    eventFullName: string;
}

export interface SheetSyncDetail {
    eventId: string;
    title?: string;
    status: 'updated' | 'skipped' | 'error';
    message?: string;
    rowIndex?: number;
    inventory?: {
        sold: number;
        capacity?: number;
    };
}

export interface SheetSyncResult {
    totalProcessed: number;
    successfulUpdates: number;
    skipped: number;
    errors: number;
    details: SheetSyncDetail[];
}
