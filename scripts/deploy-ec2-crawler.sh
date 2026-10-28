#!/usr/bin/env bash
set -euo pipefail
export AWS_REGION=il-central-1 AWS_DEFAULT_REGION=il-central-1 AWS_PAGER=''
stack=Israel-elections-ec2-crawler
aws sts get-caller-identity --query Account --output text
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
# A failed DescribeStacks is not evidence that the stack does not exist.
if aws cloudformation describe-stacks --stack-name "$stack" > "$work/stack.json" 2>"$work/error"; then
  change_type=UPDATE
  instance_id=$(aws cloudformation describe-stack-resource --stack-name "$stack" --logical-resource-id Instance --query StackResourceDetail.PhysicalResourceId --output text)
  image_id=$(aws ec2 describe-instances --instance-ids "$instance_id" --query 'Reservations[0].Instances[0].ImageId' --output text)
  [[ -z "${AMI_ID:-}" || "$AMI_ID" = "$image_id" ]] || { echo 'Changing the running instance AMI requires a separate infrastructure migration' >&2; exit 1; }
  aws cloudformation get-template --stack-name "$stack" > "$work/existing.json"
  python3 infra/ec2-crawler/build-template.py --image-id "$image_id" --existing-template "$work/existing.json" > "$work/template.json"
else
  if ! grep -q "Stack with id $stack does not exist" "$work/error"; then cat "$work/error" >&2; exit 1; fi
  change_type=CREATE
  image_id=${AMI_ID:-$(aws ssm get-parameter --name /aws/service/canonical/ubuntu/server/noble/stable/current/amd64/hvm/ebs-gp3/ami-id --query Parameter.Value --output text)}
  python3 infra/ec2-crawler/build-template.py --image-id "$image_id" > "$work/template.json"
fi
aws cloudformation validate-template --template-body "file://$work/template.json" >/dev/null
change_id=$(aws cloudformation create-change-set --stack-name "$stack" --change-set-name "crawler-$(date +%s)-$$" \
  --change-set-type "$change_type" --template-body "file://$work/template.json" --capabilities CAPABILITY_IAM \
  --parameters "ParameterKey=LatestAmiId,ParameterValue=$image_id" "ParameterKey=PublishingBucket,ParameterValue=${BUCKET:-}" "ParameterKey=DistributionId,ParameterValue=${DISTRIBUTION_ID:-}" \
  --query Id --output text)
if ! aws cloudformation wait change-set-create-complete --change-set-name "$change_id"; then
  aws cloudformation describe-change-set --change-set-name "$change_id" > "$work/changes.json"
  if ! python3 - "$work/changes.json" <<'PY'
import json, sys
result=json.load(open(sys.argv[1]))
reason=result.get('StatusReason','')
if result['Status'] != 'FAILED' or not any(text in reason for text in ["didn't contain changes", 'No updates are to be performed']):
    raise SystemExit(reason)
PY
  then exit 1; fi
  aws cloudformation delete-change-set --change-set-name "$change_id"
else
  aws cloudformation describe-change-set --change-set-name "$change_id" > "$work/changes.json"
  # Reject even conditional instance replacement; fail before changing resources.
  if ! python3 - "$work/changes.json" <<'PY'
import json, sys
changes=json.load(open(sys.argv[1]))['Changes']
for change in changes:
    resource=change['ResourceChange']
    if resource['LogicalResourceId'] == 'Instance' and (resource['Action'] == 'Remove' or resource.get('Replacement','False') != 'False'):
        raise SystemExit('Refusing a change set that may replace the crawler instance')
PY
  then
    aws cloudformation delete-change-set --change-set-name "$change_id"
    exit 1
  fi
  aws cloudformation execute-change-set --change-set-name "$change_id"
  if [[ "$change_type" = CREATE ]]; then waiter=stack-create-complete; else waiter=stack-update-complete; fi
  aws cloudformation wait "$waiter" --stack-name "$stack"
fi
aws cloudformation describe-stacks --stack-name "$stack" \
  --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue | [0]" --output text
