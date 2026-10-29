#!/usr/bin/env bash
set -euo pipefail
# Scope diagnostics to the failed invocation; an earlier browser error must not
# restart Chrome after an unrelated CSV or S3 failure.
started=$(systemctl show election-publisher.service --property=ExecMainStartTimestamp --value)
[[ -n "$started" ]] || exit 0
log=$(journalctl -u election-publisher.service --since "$started" --no-pager -o cat)
if ! grep -q 'browserType.connectOverCDP:' <<< "$log"; then
  echo 'Publisher failure is not a CDP connection failure; leaving Chrome running'
  exit 0
fi
systemctl restart election-desktop.service
# Starting a systemd desktop unit does not mean Chrome is listening yet.
for attempt in $(seq 1 30); do
  if curl --fail --silent --max-time 1 http://127.0.0.1:9222/json/version >/dev/null; then
    echo 'Chrome restarted and its debugging endpoint is ready'
    exit 0
  fi
  sleep 1
done
echo 'Chrome debugging endpoint did not become ready' >&2
exit 1
