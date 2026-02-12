#!/bin/bash
set -e

echo "⏰ Setting up cron jobs..."

# Define the cron jobs
# We use an array where each element is a cron job line
CRON_JOBS=(
    "59 7-23 * * * docker exec wordpress-parser-api node /app/dist/scripts/ozen_parse_and_sync.js"
    "40 7-23 * * * docker exec wordpress-parser-api node /app/dist/scripts/goshow_parse_and_sync.js"
    "44 7-23 * * * docker exec wordpress-parser-api node /app/dist/scripts/zygo_parse_and_sync.js"
    "35 7-23 * * * docker exec wordpress-parser-api node /app/dist/scripts/tickchak_parse_and_sync.js"
    "30 */3 * * * /usr/bin/docker restart wordpress-parser-api"
)

# Get current crontab
# If crontab doesn't exist (exit code 1), use empty string
CURRENT_CRONTAB=$(crontab -l 2>/dev/null || true)
NEW_CRONTAB="$CURRENT_CRONTAB"
UPDATED=false

for job in "${CRON_JOBS[@]}"; do
    # Check if the job already exists in the current crontab
    # We use fgrep (grep -F) for fixed string matching to avoid regex issues with * characters
    if echo "$CURRENT_CRONTAB" | grep -Fq "$job"; then
        echo "  Skipping existing job: $job"
    else
        echo "  Adding new job: $job"
        if [ -z "$NEW_CRONTAB" ]; then
            NEW_CRONTAB="$job"
        else
            NEW_CRONTAB="$NEW_CRONTAB
$job"
        fi
        UPDATED=true
    fi
done

# If we made changes, update the crontab
if [ "$UPDATED" = true ]; then
    echo "$NEW_CRONTAB" | crontab -
    echo "✅ Crontab updated successfully"
else
    echo "✅ Crontab is already up to date"
fi
