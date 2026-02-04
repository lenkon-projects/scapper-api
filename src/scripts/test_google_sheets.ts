import "dotenv/config";
import { google } from "googleapis";
import path from "path";
import GoogleSheetsService from "../services/google-sheets.service";

async function main() {
  console.log("[TestGoogleSheets] Starting test...\n");

  // Phase 0: List all sheet names in the spreadsheet
  console.log("=== Phase 0: Listing available sheets ===\n");

  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SHEETS_CREDENTIALS_PATH || path.resolve(process.cwd(), "credentials.json"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "1vpqx1tsGbH-3ltlSiQNn4_Ui39-KSeb2YTjA_G0IT94";

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetNames = meta.data.sheets?.map((s) => s.properties?.title) || [];
  console.log("Available sheets:", sheetNames.join(", "));
  console.log("");

  const sheetsService = GoogleSheetsService.getInstance();

  // Phase 1: Read all items
  console.log("=== Phase 1: Reading all items from Google Sheets ===\n");

  const items = await sheetsService.getAllItems();
  console.log(`Found ${items.length} rows:\n`);

  for (const item of items) {
    console.log(
      `  Row ${item.rowIndex}: [${item.eventId}] ${item.bandName} | ${item.eventDate} | capacity=${item.capacity} sold=${item.totalTicketsSold} | status=${item.eventStatus}`
    );
  }

  if (items.length === 0) {
    console.log("No items found. Nothing to update.");
    return;
  }

  // Phase 2: Update the first row's "Last_snapshot_at" column with current timestamp
  const targetRow = items[0];
  console.log(`\n=== Phase 2: Updating row ${targetRow.rowIndex} (${targetRow.bandName}) ===\n`);

  const now = new Date();
  const updated = await sheetsService.updateItem(
    targetRow.rowIndex,
    {
      eventId: targetRow.eventId,
      ticketsSold: {
        capacity: targetRow.capacity,
        total: targetRow.totalTicketsSold,
      },
    },
    now
  );

  if (updated) {
    console.log(`Successfully updated row ${targetRow.rowIndex} with timestamp ${now.toISOString()}`);
  } else {
    console.log(`Failed to update row ${targetRow.rowIndex}`);
  }

  // Phase 3: Verify by re-reading
  console.log("\n=== Phase 3: Verifying update ===\n");

  const updatedItems = await sheetsService.getAllItems();
  const verifiedRow = updatedItems.find((r) => r.rowIndex === targetRow.rowIndex);

  if (verifiedRow) {
    console.log(
      `  Row ${verifiedRow.rowIndex}: lastSnapshotAt = "${verifiedRow.lastSnapshotAt}"`
    );
  }

  console.log("\n[TestGoogleSheets] Done!");
}

main().catch((error) => {
  console.error("[TestGoogleSheets] Error:", error);
  process.exit(1);
});
