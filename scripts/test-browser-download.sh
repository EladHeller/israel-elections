#!/usr/bin/env bash
set -euo pipefail
: "${AWS_REGION:?Set AWS_REGION to the dev region}"
: "${GITHUB_SHA:?Set GITHUB_SHA to the source commit}"
export AWS_PAGER=''
aws sts get-caller-identity --query Account --output text
for template in infra/playwright/{ecr,diagnostic}.cf.yaml; do
  aws cloudformation validate-template --template-body "file://$template" > /dev/null
done
aws cloudformation deploy --stack-name Israel-elections-city-download-ecr \
  --template-file infra/playwright/ecr.cf.yaml --no-fail-on-empty-changeset
repository=$(aws cloudformation describe-stacks --stack-name Israel-elections-city-download-ecr \
  --query "Stacks[0].Outputs[?OutputKey=='RepositoryUri'].OutputValue | [0]" --output text)
registry=${repository%%/*}
image="$repository:${GITHUB_SHA:0:12}-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
aws ecr get-login-password | docker login --username AWS --password-stdin "$registry"
docker buildx build --platform linux/amd64 --provenance=false --load \
  -f infra/playwright/Dockerfile -t "$image" .
docker push "$image"
aws cloudformation deploy --stack-name Israel-elections-city-download \
  --template-file infra/playwright/diagnostic.cf.yaml --capabilities CAPABILITY_IAM \
  --parameter-overrides "ImageUri=$image" --no-fail-on-empty-changeset
aws lambda wait function-active-v2 --function-name Israel-elections-city-download
aws lambda invoke --function-name Israel-elections-city-download \
  --cli-read-timeout 330 --cli-connect-timeout 30 \
  --payload '{}' --cli-binary-format raw-in-base64-out \
  /tmp/city-download-result.json > /tmp/city-download-invoke.json
node - <<'JS'
const fs = require('node:fs');
const invocation = JSON.parse(fs.readFileSync('/tmp/city-download-invoke.json', 'utf8'));
const result = JSON.parse(fs.readFileSync('/tmp/city-download-result.json', 'utf8'));
console.log(JSON.stringify(result, null, 2));
if (invocation.FunctionError || result.statusCode !== 200 || !JSON.parse(result.body).ok) process.exit(1);
JS
