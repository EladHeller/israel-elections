#!/usr/bin/env bash
set -euo pipefail
: "${SOURCE_REF:?}" "${BUCKET:?}" "${DISTRIBUTION_ID:?}" "${REGION:?}"
[[ "$SOURCE_REF" =~ ^[a-f0-9]{40}$ && "$BUCKET" =~ ^[a-z0-9.-]+$ && "$DISTRIBUTION_ID" =~ ^[A-Z0-9]+$ && "$REGION" =~ ^[a-z0-9-]+$ ]]
root=${CRAWLER_ROOT:-/opt/election-crawler}
units=${CRAWLER_UNITS:-/etc/systemd/system}
config=${CRAWLER_CONFIG:-/etc/election-publisher.env}
mkdir -p "$root/releases"
exec 9>"$root/deploy.lock"
flock -w 30 9
status_bucket=${CRAWLER_STATUS_BUCKET:-}
[[ -z "$status_bucket" || "$status_bucket" =~ ^[a-z0-9.-]+$ ]]
identity="$SOURCE_REF|$BUCKET|$DISTRIBUTION_ID|$REGION|$status_bucket"
release="$root/releases/$SOURCE_REF-v2"
if [[ -f "$root/deployed" && "$(cat "$root/deployed")" = "$identity" && "$(readlink "$root/app")" = "$release" ]] \
  && systemctl is-active --quiet election-publisher.timer; then
  echo "Already deployed $SOURCE_REF; no services restarted"
  exit 0
fi
stage=''
backup=$(mktemp -d "$root/.deployment-XXXXXX")
activated=0
committed=0
previous=$(readlink "$root/app" || true)
timer_active=0
timer_enabled=0
service_active=0
systemctl is-active --quiet election-publisher.timer && timer_active=1
systemctl is-enabled --quiet election-publisher.timer && timer_enabled=1
systemctl is-active --quiet election-publisher.service && service_active=1
files=("$config" "$root/deployed" "$root/crawl.mjs" "$root/download.mjs" "$root/publish.cjs" "$units/election-publisher.service" "$units/election-publisher.timer")
for i in "${!files[@]}"; do
  [[ ! -e "${files[$i]}" ]] || cp -a "${files[$i]}" "$backup/$i"
done
finish() {
  local status=$?
  trap - EXIT
  if (( activated && ! committed )); then
    echo 'Activation failed; restoring the previous release' >&2
    set +e
    systemctl stop election-publisher.timer election-publisher.service
    if [[ -n "$previous" ]]; then
      ln -sfn "$previous" "$root/app.next"
      mv -Tf "$root/app.next" "$root/app"
    else
      rm -f "$root/app"
    fi
    for i in "${!files[@]}"; do
      if [[ -e "$backup/$i" ]]; then cp -a "$backup/$i" "${files[$i]}"; else rm -f "${files[$i]}"; fi
    done
    systemctl daemon-reload
    if (( timer_enabled )); then systemctl enable election-publisher.timer; else systemctl disable election-publisher.timer; fi
    if (( timer_active )); then systemctl start election-publisher.timer; fi
    if (( timer_active || service_active )); then
      # A rollback health-check failure must remain visible; keep the timer retrying.
      systemctl start election-publisher.service || echo 'Previous release health check failed; see journal' >&2
    fi
  fi
  [[ -z "$stage" ]] || rm -rf "$stage"
  rm -rf "$backup"
  exit "$status"
}
trap finish EXIT
# Build in a separate directory while the old timer continues running.
if [[ ! -f "$release/.prepared" ]]; then
  stage=$(mktemp -d "$root/releases/.prepare-XXXXXX")
  curl -fsSL "https://codeload.github.com/EladHeller/israel-elections/tar.gz/$SOURCE_REF" -o "$stage/source.tar.gz"
  tar -xzf "$stage/source.tar.gz" --strip-components=1 -C "$stage"
  rm "$stage/source.tar.gz"
  chown -R crawler:crawler "$stage"
  sudo -u crawler bash -c 'cd "$1" && npm ci && npm run build' -- "$stage"
  test -f "$stage/dist/csv-monitor.js"
  for file in crawl.mjs download.mjs publish.cjs election-publisher.service election-publisher.timer; do
    test -f "$stage/infra/ec2-crawler/$file"
  done
  touch "$stage/.prepared"
  # A directory left by the previous installer is never reused as a prepared release.
  [[ ! -e "$release" ]] || { echo "Unprepared release directory already exists: $release" >&2; exit 1; }
  mv "$stage" "$release"
  stage=''
fi
activated=1
systemctl stop election-publisher.timer election-publisher.service
ln -sfn "$release" "$root/app.next"
mv -Tf "$root/app.next" "$root/app"
for file in crawl.mjs download.mjs publish.cjs; do cp "$release/infra/ec2-crawler/$file" "$root/$file"; done
cp "$release/infra/ec2-crawler/"election-publisher.* "$units/"
printf '%s\n' "BUCKET=$BUCKET" "DISTRIBUTION_ID=$DISTRIBUTION_ID" "REGION=$REGION" 'CURR_ELECTIONS=26' "CRAWLER_STATUS_BUCKET=$status_bucket" > "$config"
chmod 600 "$config"
systemctl daemon-reload
systemctl start election-publisher.service
systemctl enable --now election-publisher.timer
printf '%s\n' "$identity" > "$root/deployed.next"
mv -f "$root/deployed.next" "$root/deployed"
committed=1
shutdown -c || true
systemctl status election-publisher.timer --no-pager
journalctl -u election-publisher.service -n 10 --no-pager
