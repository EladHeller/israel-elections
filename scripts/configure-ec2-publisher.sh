#!/usr/bin/env bash
set -euo pipefail
: "${INSTANCE_ID:?Set INSTANCE_ID}"
: "${SOURCE_REF:?Set SOURCE_REF to a published commit}"
: "${BUCKET:?Set BUCKET}"
: "${DISTRIBUTION_ID:?Set DISTRIBUTION_ID}"
export INSTANCE_ID SOURCE_REF BUCKET DISTRIBUTION_ID
export REGION=${REGION:-us-east-1}
params=$(mktemp)
trap 'rm -f "$params"' EXIT
python3 - "$params" <<'PY'
import json, os, re, sys
for name, pattern in [('INSTANCE_ID',r'i-[a-f0-9]+'),('SOURCE_REF',r'[a-f0-9]{40}'),('BUCKET',r'[a-z0-9.-]+'),('DISTRIBUTION_ID',r'[A-Z0-9]+'),('REGION',r'[a-z0-9-]+')]:
    if not re.fullmatch(pattern,os.environ[name]): raise ValueError('Invalid '+name)
ref=os.environ['SOURCE_REF']
script=f'''set -eu
systemctl stop election-publisher.timer 2>/dev/null || true
systemctl stop election-publisher.service 2>/dev/null || true
mkdir -p /opt/election-crawler/releases/{ref}
curl -fsSL https://codeload.github.com/EladHeller/israel-elections/tar.gz/{ref} -o /tmp/election-source.tar.gz
tar -xzf /tmp/election-source.tar.gz --strip-components=1 -C /opt/election-crawler/releases/{ref}
chown -R crawler:crawler /opt/election-crawler/releases/{ref}
sudo -u crawler bash -c 'cd /opt/election-crawler/releases/{ref} && npm ci && npm run build'
ln -sfn /opt/election-crawler/releases/{ref} /opt/election-crawler/app
cp /opt/election-crawler/app/infra/ec2-crawler/crawl.mjs /opt/election-crawler/crawl.mjs
cp /opt/election-crawler/app/infra/ec2-crawler/publish.cjs /opt/election-crawler/publish.cjs
cp /opt/election-crawler/app/infra/ec2-crawler/election-publisher.* /etc/systemd/system/
printf '%s\\n' 'BUCKET={os.environ['BUCKET']}' 'DISTRIBUTION_ID={os.environ['DISTRIBUTION_ID']}' 'REGION={os.environ['REGION']}' 'CURR_ELECTIONS=26' > /etc/election-publisher.env
chmod 600 /etc/election-publisher.env
systemctl daemon-reload
systemctl start election-publisher.service
# Keep the compute running only after a successful validated publish.
shutdown -c || true
systemctl enable --now election-publisher.timer
systemctl status election-publisher.timer --no-pager
journalctl -u election-publisher.service -n 10 --no-pager
'''
json.dump({'commands':[script],'executionTimeout':['900']},open(sys.argv[1],'w'))
PY
command_id=$(aws ssm send-command --region il-central-1 --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript --parameters "file://$params" --query Command.CommandId --output text)
printf 'SSM deployment command: %s\n' "$command_id"
# SSM's standard waiter is shorter than a cold npm installation; poll the status.
for attempt in $(seq 1 90); do
  status=$(aws ssm get-command-invocation --region il-central-1 --instance-id "$INSTANCE_ID" --command-id "$command_id" --query Status --output text 2>/dev/null || true)
  case "$status" in
    Success) break ;;
    Failed|Cancelled|TimedOut) break ;;
  esac
  sleep 10
done
aws ssm get-command-invocation --region il-central-1 --instance-id "$INSTANCE_ID" --command-id "$command_id"
[ "$status" = Success ]
