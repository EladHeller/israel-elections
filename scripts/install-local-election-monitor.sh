#!/bin/zsh
set -euo pipefail

LABEL="com.eladheller.israel-elections-results"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/israel-elections"
MODE="${1:-}"
AWS_PROFILE_NAME="${2:-${AWS_PROFILE:-default}}"
POLL_INTERVAL_MS="${3:-15000}"

usage() {
  echo "Usage: npm run monitor:local:install -- <dev|prod> [aws-profile] [poll-interval-ms]"
  exit 2
}

case "$MODE" in
  prod)
    REGION="us-east-1"
    BUCKET="israel-election-client-code-bucket"
    DISTRIBUTION_ID="E1OWGU8IX0MTF6"
    ;;
  dev)
    REGION="eu-west-3"
    BUCKET="israel-elections-dev-code-bucket"
    DISTRIBUTION_ID="E29Q99472X96XW"
    ;;
  *) usage ;;
esac

if ! [[ "$POLL_INTERVAL_MS" =~ ^[0-9]+$ ]] || (( POLL_INTERVAL_MS < 5000 )); then
  echo "poll-interval-ms must be an integer >= 5000"
  exit 2
fi

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "node was not found in PATH"
  exit 1
fi

TSX_CLI="$ROOT_DIR/node_modules/tsx/dist/cli.mjs"
if [[ ! -f "$TSX_CLI" ]]; then
  echo "Installing project dependencies..."
  (cd "$ROOT_DIR" && npm ci)
fi

xml_escape() {
  printf '%s' "$1" | sed \
    -e 's/&/\&amp;/g' \
    -e 's/</\&lt;/g' \
    -e 's/>/\&gt;/g' \
    -e 's/"/\&quot;/g'
}

NODE_XML="$(xml_escape "$NODE_BIN")"
TSX_XML="$(xml_escape "$TSX_CLI")"
ROOT_XML="$(xml_escape "$ROOT_DIR")"
PROFILE_XML="$(xml_escape "$AWS_PROFILE_NAME")"
BUCKET_XML="$(xml_escape "$BUCKET")"
DISTRIBUTION_XML="$(xml_escape "$DISTRIBUTION_ID")"
REGION_XML="$(xml_escape "$REGION")"
INTERVAL_XML="$(xml_escape "$POLL_INTERVAL_MS")"

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

MONITOR="$ROOT_DIR/election-results-listener/local-monitor.ts"
echo "Running one real preflight poll against $MODE before installing..."
env \
  AWS_PROFILE="$AWS_PROFILE_NAME" \
  AWS_SDK_LOAD_CONFIG=1 \
  CURR_ELECTIONS=26 \
  REGION="$REGION" \
  BUCKET="$BUCKET" \
  DISTRIBUTION_ID="$DISTRIBUTION_ID" \
  LOCAL_POLL_INTERVAL_MS="$POLL_INTERVAL_MS" \
  "$NODE_BIN" "$TSX_CLI" "$MONITOR" --once

launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_XML</string>
    <string>$TSX_XML</string>
    <string>$ROOT_XML/election-results-listener/local-monitor.ts</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT_XML</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>5</integer>
  <key>ProcessType</key>
  <string>Background</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>AWS_PROFILE</key>
    <string>$PROFILE_XML</string>
    <key>AWS_SDK_LOAD_CONFIG</key>
    <string>1</string>
    <key>CURR_ELECTIONS</key>
    <string>26</string>
    <key>REGION</key>
    <string>$REGION_XML</string>
    <key>BUCKET</key>
    <string>$BUCKET_XML</string>
    <key>DISTRIBUTION_ID</key>
    <string>$DISTRIBUTION_XML</string>
    <key>LOCAL_POLL_INTERVAL_MS</key>
    <string>$INTERVAL_XML</string>
  </dict>
  <key>StandardOutPath</key>
  <string>$(xml_escape "$LOG_DIR/results-monitor.log")</string>
  <key>StandardErrorPath</key>
  <string>$(xml_escape "$LOG_DIR/results-monitor.error.log")</string>
</dict>
</plist>
EOF

plutil -lint "$PLIST" >/dev/null
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

echo "Installed and started $LABEL ($MODE, every ${POLL_INTERVAL_MS}ms)."
echo "Status: launchctl print gui/$(id -u)/$LABEL"
echo "Logs:   tail -f $LOG_DIR/results-monitor.log $LOG_DIR/results-monitor.error.log"
