#!/bin/bash
# Weekly token refresh for Instagram + Threads
# Extends 60-day tokens so they never expire
#
# Install: launchctl load ~/Library/LaunchAgents/com.phantomloom.token-refresh.plist
# Uninstall: launchctl unload ~/Library/LaunchAgents/com.phantomloom.token-refresh.plist
# Manual run: bash agent/scripts/token-refresh-cron.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
LOG="$PROJECT_DIR/output/token-refresh.log"

echo "$(date -Iseconds) — token refresh start" >> "$LOG"

cd "$PROJECT_DIR/agent"
/opt/homebrew/bin/npx tsx src/cli.ts token refresh 2>&1 | tee -a "$LOG"

echo "$(date -Iseconds) — token refresh done" >> "$LOG"
echo "" >> "$LOG"
