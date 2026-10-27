#!/bin/zsh
set -euo pipefail

LABEL="com.eladheller.israel-elections-results"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
rm -f "$PLIST"

echo "Stopped and removed $LABEL. Logs were kept under ~/Library/Logs/israel-elections/."
