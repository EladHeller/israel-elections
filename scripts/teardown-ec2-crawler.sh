#!/usr/bin/env bash
set -euo pipefail
export AWS_REGION=il-central-1 AWS_DEFAULT_REGION=il-central-1 AWS_PAGER=''
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
aws sts get-caller-identity --query Account --output text

# Remove the monitor first: its inline policy references the crawler's IAM role.
# Its three small status objects are retained by the existing template for diagnostics.
for stack in Israel-elections-crawler-monitor Israel-elections-ec2-crawler; do
  if aws cloudformation describe-stacks --stack-name "$stack" > "$work/stack.json" 2> "$work/error"; then
    status=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["Stacks"][0]["StackStatus"])' "$work/stack.json")
    if [[ "$status" != DELETE_IN_PROGRESS ]]; then
      if [[ "$stack" = Israel-elections-crawler-monitor ]]; then
        aws cloudwatch disable-alarm-actions --alarm-names israel-elections-crawler-health
      fi
      aws cloudformation list-stack-resources --stack-name "$stack"
      aws cloudformation delete-stack --stack-name "$stack"
    fi
    aws cloudformation wait stack-delete-complete --stack-name "$stack"
    echo "Deleted $stack"
  elif grep -Fq "Stack with id $stack does not exist" "$work/error"; then
    echo "$stack is already absent"
  else
    cat "$work/error" >&2
    exit 1
  fi
done
