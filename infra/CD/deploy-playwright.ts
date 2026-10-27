import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

const region = process.env.REGION || 'us-east-1';
const clientCodeName = process.env.CLIENT_CODE_BUCKET;
const currElections = process.env.CURR_ELECTIONS;
const imageTag = process.env.GITHUB_SHA?.slice(0, 12) || Date.now().toString();

async function run(command: string): Promise<string> {
  const { stdout, stderr } = await exec(command, { maxBuffer: 10 * 1024 * 1024 });
  if (stderr.trim()) console.log(stderr.trim());
  return stdout.trim();
}

async function stackOutput(stackName: string, outputKey: string): Promise<string> {
  return run(
    `aws cloudformation describe-stacks --region ${region} --stack-name ${stackName} `
    + `--query "Stacks[0].Outputs[?OutputKey=='${outputKey}'].OutputValue | [0]" --output text`,
  );
}

async function main() {
  if (!clientCodeName || !currElections) {
    throw new Error('Missing required environment variables');
  }

  console.log('Deploying Playwright ECR repository...');
  await run(
    `aws cloudformation deploy --region ${region} `
    + '--stack-name Israel-elections-playwright-ecr '
    + '--template-file ./infra/CD/playwright-ecr.cf.yaml '
    + '--no-fail-on-empty-changeset',
  );

  const repositoryUri = await stackOutput('Israel-elections-playwright-ecr', 'RepositoryUri');
  if (!repositoryUri || repositoryUri === 'None') throw new Error('Missing Playwright RepositoryUri');

  const registry = repositoryUri.split('/')[0];
  const imageUri = `${repositoryUri}:${imageTag}`;

  console.log(`Building Playwright image ${imageUri}...`);
  await run(
    `aws ecr get-login-password --region ${region} `
    + `| docker login --username AWS --password-stdin ${registry}`,
  );
  await run(
    `docker buildx build --platform=linux/amd64 --provenance=false --load `
    + `-t ${imageUri} -f ./infra/playwright/Dockerfile .`,
  );
  await run(`docker push ${imageUri}`);

  const distributionId = await stackOutput('Israel-elections-code-bucket', 'DistributionId');
  if (!distributionId || distributionId === 'None') throw new Error('Missing DistributionId');

  console.log('Deploying Playwright Lambda...');
  await run(
    `aws cloudformation deploy --region ${region} `
    + '--stack-name Israel-elections-playwright '
    + '--template-file ./infra/CD/playwright-lambda.cf.yaml '
    + '--capabilities CAPABILITY_NAMED_IAM '
    + `--parameter-overrides ImageUri=${imageUri} ClientCodeName=${clientCodeName} `
    + `CurrentElections=${currElections} Region=${region} DistributionId=${distributionId} `
    + '--no-fail-on-empty-changeset',
  );

  console.log('Playwright Lambda deployment completed successfully.');
}

main().catch(err => {
  console.error('Playwright Lambda deployment failed:', err);
  process.exit(1);
});
