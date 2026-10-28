#!/usr/bin/env bash
set -euo pipefail
export AWS_REGION=il-central-1 AWS_DEFAULT_REGION=il-central-1 AWS_PAGER=''
aws sts get-caller-identity --query Account --output text
python3 - <<'PY'
import base64, json, pathlib, yaml
class Loader(yaml.SafeLoader): pass
Loader.add_constructor('!Ref', lambda loader, node: {'Ref': loader.construct_scalar(node)})
Loader.add_constructor('!And', lambda loader, node: {'Fn::And': loader.construct_sequence(node, deep=True)})
Loader.add_constructor('!Not', lambda loader, node: {'Fn::Not': loader.construct_sequence(node, deep=True)})
Loader.add_constructor('!Equals', lambda loader, node: {'Fn::Equals': loader.construct_sequence(node, deep=True)})
Loader.add_constructor('!Sub', lambda loader, node: {'Fn::Sub': loader.construct_scalar(node)})
template=yaml.load(pathlib.Path('infra/ec2-crawler/stack.yaml').read_text(), Loader=Loader)
bootstrap=pathlib.Path('infra/ec2-crawler/bootstrap.sh').read_text()
install=''
for name in ['crawl.mjs','download.mjs']:
    crawler=base64.b64encode(pathlib.Path('infra/ec2-crawler',name).read_bytes()).decode()
    install+="printf '%s' '"+crawler+"' | base64 -d > /opt/election-crawler/"+name+"\nchown crawler:crawler /opt/election-crawler/"+name+"\n"
template['Resources']['Instance']['Properties']['UserData']['Fn::Base64']=bootstrap.replace('touch /opt/election-crawler/bootstrap-ready', install+'touch /opt/election-crawler/bootstrap-ready')
pathlib.Path('/tmp/election-ec2-template.json').write_text(json.dumps(template))
PY
aws cloudformation validate-template --template-body file:///tmp/election-ec2-template.json >/dev/null
aws cloudformation deploy --stack-name Israel-elections-ec2-crawler \
  --template-file /tmp/election-ec2-template.json --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset \
  --parameter-overrides "PublishingBucket=${BUCKET:-}" "DistributionId=${DISTRIBUTION_ID:-}"
aws cloudformation describe-stacks --stack-name Israel-elections-ec2-crawler \
  --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue | [0]" --output text
