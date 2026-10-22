import { LambdaClient, UpdateFunctionCodeCommand, waitUntilFunctionUpdatedV2 } from '@aws-sdk/client-lambda';
import {
  CloudFormationClient,
  DescribeStacksCommand,
  CreateStackCommand,
  UpdateStackCommand,
  waitUntilStackCreateComplete,
  waitUntilStackUpdateComplete,
  Parameter,
  Capability,
  Output,
} from '@aws-sdk/client-cloudformation';
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from '@aws-sdk/client-cloudfront';
import fs from 'fs/promises';
import electionManifests from '../../elections-client/src/data/elections-manifests.json';
import { LATEST_ELECTION_ID } from '../../elections-client/src/lib/data';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { FileData, getAllDirsFiles, upload } from '../s3';

const exec = promisify(execCallback);

const region = process.env.REGION || 'us-east-1';
const bucketCodeName = process.env.CODE_BUCKET;
const clientCodeName = process.env.CLIENT_CODE_BUCKET;
const currElections = process.env.CURR_ELECTIONS;
const domainName = process.env.DOMAIN_NAME;
const subDomain = process.env.SUB_DOMAIN || 'elections';
const hostedZoneId = process.env.HOSTED_ZONE_ID;
const rawEnv = process.env.NODE_ENV || 'production';
const environment = rawEnv === 'prod' || rawEnv === 'production' ? 'production' : 'develop';

const cf = new CloudFormationClient({ region });
const cfClient = new CloudFrontClient({ region });

async function getStackOutputs(name: string): Promise<Output[] | undefined> {
  const stack = await cf.send(new DescribeStacksCommand({ StackName: name })).catch(() => ({ Stacks: [] }));
  return stack.Stacks?.[0]?.Outputs;
}

async function runTemplate(
  templatePath: string,
  name: string,
  parameters?: Parameter[],
  capabilities?: Capability[],
) {
  console.log(`Running template ${name}...`);
  const stack = await cf.send(new DescribeStacksCommand({
    StackName: name,
  })).catch(() => ({ Stacks: [] }));

  const template = await fs.readFile(templatePath, 'utf-8');
  const isNewStack = stack.Stacks == null || stack.Stacks.length < 1;

  if (isNewStack) {
    await cf.send(new CreateStackCommand({
      StackName: name,
      TemplateBody: template,
      Capabilities: capabilities,
      Parameters: parameters,
    }));
    await waitUntilStackCreateComplete({ client: cf, maxWaitTime: 1200 }, { StackName: name });
  } else {
    try {
      await cf.send(new UpdateStackCommand({
        StackName: name,
        TemplateBody: template,
        Capabilities: capabilities,
        Parameters: parameters,
      }));
      await waitUntilStackUpdateComplete({ client: cf, maxWaitTime: 1200 }, { StackName: name });
    } catch (e: any) {
      if (e.message === 'No updates are to be performed.') {
        console.log(`Template ${name}: No updates are to be performed.`);
        return stack.Stacks?.[0]?.Outputs;
      }
      throw e;
    }
  }

  const updatedStack = await cf.send(new DescribeStacksCommand({
    StackName: name,
  }));
  console.log(`Template ${name} updated.`);
  return updatedStack.Stacks?.[0]?.Outputs;
}

async function buildAndZip(siteUrl: string) {
  console.log('Building backend...');
  await exec('npm run build');

  console.log('Building frontend...');
  await exec('npm run build:client', { env: { ...process.env, VITE_SITE_URL: siteUrl } });

  console.log('Creating zips...');
  // Backend zip
  await exec('rm -f dist.zip && zip -rq9 dist.zip ./dist ./node_modules');
  // Client zip
  await exec('rm -f client.zip && zip -rq9 client.zip ./elections-client/dist');
}

async function uploadFiles(distributionId: string) {
  console.log('Uploading files to S3...');
  if (!bucketCodeName || !clientCodeName) {
    throw new Error('Bucket names missing');
  }

  const updatedFiles: string[] = [];

  // Upload backend zip
  const updatedZip = await upload(bucketCodeName, 'dist.zip', './dist.zip');
  if (updatedZip) updatedFiles.push('/dist.zip');

  // Upload client files
  const basePath = './elections-client/dist';
  const files = await getAllDirsFiles([basePath]);

  await Promise.all(files.map(async ({ file }: FileData) => {
    const key = file.replace(`${basePath}/`, '');
    const updated = await upload(clientCodeName, key, file);
    if (updated) updatedFiles.push(`/${key}`);
  }));

  // Upload client zip
  const updatedClientZip = await upload(clientCodeName, 'client.zip', './client.zip');
  if (updatedClientZip) updatedFiles.push('/client.zip');

  if (updatedFiles.length > 0) {
    console.log(`Invalidating ${updatedFiles.length} files in CloudFront...`);
    await cfClient.send(new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: Date.now().toString(),
        Paths: {
          Quantity: updatedFiles.length,
          Items: updatedFiles,
        },
      },
    }));
  }
}

function scenarioApiDomain(endpoint?: string): string | undefined {
  return endpoint?.replace(/^https:\/\//, '').replace(/\/$/, '');
}

function getOutput(outputs: Output[] | undefined, key: string): string | undefined {
  return outputs?.find(output => output.OutputKey === key)?.OutputValue;
}

function t00Parameters(apiEndpoint?: string): Parameter[] {
  const parameters: Parameter[] = [
    { ParameterKey: 'BucketCodeName', ParameterValue: bucketCodeName },
    { ParameterKey: 'ClientCodeName', ParameterValue: clientCodeName },
    { ParameterKey: 'SubDomain', ParameterValue: subDomain },
    { ParameterKey: 'Environment', ParameterValue: environment },
    { ParameterKey: 'CurrentElections', ParameterValue: currElections },
    { ParameterKey: 'LatestElectionId', ParameterValue: String(Math.max(LATEST_ELECTION_ID, ...Object.keys(electionManifests).map(Number))) },
  ];
  if (domainName) parameters.push({ ParameterKey: 'DomainName', ParameterValue: domainName });
  if (hostedZoneId) parameters.push({ ParameterKey: 'HostedZoneId', ParameterValue: hostedZoneId });
  const apiDomain = scenarioApiDomain(apiEndpoint);
  if (apiDomain) parameters.push({ ParameterKey: 'ScenarioApiDomain', ParameterValue: apiDomain });
  return parameters;
}

async function main() {
  if (!bucketCodeName || !clientCodeName || !currElections) {
    throw new Error('Missing required environment variables');
  }

  // Keep the existing API origin on routine deploys. On the first deployment the API does not exist yet,
  // so t00 creates the buckets/CDN first and is updated again after t01 creates the API.
  const existingBackendOutputs = await getStackOutputs('Israel-elections');
  const existingScenarioApiEndpoint = getOutput(existingBackendOutputs, 'ScenarioApiEndpoint');
  const t00Outputs = await runTemplate(
    './infra/CD/t00.cf.yaml',
    'Israel-elections-code-bucket',
    t00Parameters(existingScenarioApiEndpoint),
  );
  const distributionId = getOutput(t00Outputs, 'DistributionId');

  if (!distributionId) throw new Error('Missing DistributionId output');

  const siteUrl = getOutput(t00Outputs, 'SiteUrl');
  if (!siteUrl) throw new Error('Missing SiteUrl output');
  await buildAndZip(siteUrl);
  await uploadFiles(distributionId);

  const backendOutputs = await runTemplate(
    './infra/CD/t01.cf.yaml',
    'Israel-elections',
    [
      { ParameterKey: 'BucketCodeName', ParameterValue: bucketCodeName },
      { ParameterKey: 'ClientCodeName', ParameterValue: clientCodeName },
      { ParameterKey: 'Region', ParameterValue: region },
      { ParameterKey: 'CurrentElections', ParameterValue: currElections },
      { ParameterKey: 'DistributionId', ParameterValue: distributionId },
    ],
    ['CAPABILITY_NAMED_IAM'],
  );

  // S3Key stays dist.zip, so CloudFormation cannot detect a new code archive.
  const lambda = new LambdaClient({ region });
  for (const FunctionName of ['Israel-elections-function', 'Israel-elections-scenario-share']) {
    await lambda.send(new UpdateFunctionCodeCommand({
      FunctionName, S3Bucket: bucketCodeName, S3Key: 'dist.zip',
    }));
    await waitUntilFunctionUpdatedV2({ client: lambda, maxWaitTime: 300 }, { FunctionName });
  }

  const newScenarioApiEndpoint = getOutput(backendOutputs, 'ScenarioApiEndpoint');
  if (!newScenarioApiEndpoint) throw new Error('Missing ScenarioApiEndpoint output');

  await runTemplate(
    './infra/CD/t00.cf.yaml',
    'Israel-elections-code-bucket',
    t00Parameters(newScenarioApiEndpoint),
  );

  console.log('Deployment completed successfully!');
}

main().catch(err => {
  console.error('Deployment failed:', err);
  process.exit(1);
});

