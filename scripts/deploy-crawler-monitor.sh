#!/usr/bin/env bash
set -euo pipefail
export CRAWLER_ALERT_EMAIL=${CRAWLER_ALERT_EMAIL:-}
region=il-central-1
role=$(aws cloudformation describe-stack-resource --region "$region" \
  --stack-name Israel-elections-ec2-crawler --logical-resource-id Role \
  --query StackResourceDetail.PhysicalResourceId --output text)
template=$(mktemp)
trap 'rm -f "$template"' EXIT
# Inline code keeps this small monitor independent of artifact buckets and the EC2 host.
python3 - "$template" <<'PY'
import pathlib, sys
sys.path.insert(0, 'infra/ec2-crawler')
from importlib import import_module
builder = import_module('build-template')
import yaml
builder.Loader.add_constructor('!GetAtt', lambda loader, node: {'Fn::GetAtt': loader.construct_scalar(node).split('.', 1)})
root = pathlib.Path('infra/crawler-monitor')
template = yaml.load((root/'stack.yaml').read_text(), Loader=builder.Loader)
health = (root/'health.cjs').read_text().replace('module.exports = { evaluate };', '')
handler = (root/'index.cjs').read_text().replace("const { evaluate } = require('./health.cjs');", '')
template['Resources']['Monitor']['Properties']['Code']['ZipFile'] = health + '\n' + handler
pathlib.Path(sys.argv[1]).write_text(yaml.safe_dump(template, sort_keys=False))
PY
aws cloudformation deploy --region "$region" --stack-name Israel-elections-crawler-monitor \
  --template-file "$template" --capabilities CAPABILITY_IAM \
  --parameter-overrides "CrawlerRole=$role" "AlertEmail=$CRAWLER_ALERT_EMAIL" \
  --no-fail-on-empty-changeset
if [[ -z "$CRAWLER_ALERT_EMAIL" ]]; then
  echo '::warning::Monitoring deployed without an email subscription. Set the prod GitHub variable CRAWLER_ALERT_EMAIL and confirm the SNS subscription.'
fi
