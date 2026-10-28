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
import json, os, pathlib, re, shlex, sys
for name, pattern in [('INSTANCE_ID',r'i-[a-f0-9]+'),('SOURCE_REF',r'[a-f0-9]{40}'),('BUCKET',r'[a-z0-9.-]+'),('DISTRIBUTION_ID',r'[A-Z0-9]+'),('REGION',r'[a-z0-9-]+')]:
    if not re.fullmatch(pattern,os.environ[name]): raise ValueError('Invalid '+name)
installer=pathlib.Path('infra/ec2-crawler/install-release.sh').read_text()
settings=' '.join(name+'='+shlex.quote(os.environ[name]) for name in ['SOURCE_REF','BUCKET','DISTRIBUTION_ID','REGION'])
script="env "+settings+" bash <<'ELECTION_INSTALLER'\n"+installer+"\nELECTION_INSTALLER\n"
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
