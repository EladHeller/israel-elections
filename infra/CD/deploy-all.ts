import {
  CloudFormationClient,
  DescribeStacksCommand,
  CreateStackCommand,
  UpdateStackCommand,
  waitUntilStackCreateComplete,
  waitUntilStackUpdateComplete,
  Parameter,
  Capability,
} from '@aws-sdk/client-cloudformation';
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from '@aws-sdk/client-cloudfront';
import fs from 'fs/promises';
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

async function buildAndZip() {
  console.log('Building backend...');
  await exec('npm run build');

  console.log('Building frontend...');
  await exec('npm run build:client');

  console.log('Creating zips...');
  // Backend zip
  await exec('rm -f dist.zip && zip -rq9 dist.zip ./dist');
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

async function main() {
  if (!bucketCodeName || !clientCodeName || !currElections) {
    throw new Error('Missing required environment variables');
  }

  await buildAndZip();

  const t00Params: Parameter[] = [
    { ParameterKey: 'BucketCodeName', ParameterValue: bucketCodeName },
    { ParameterKey: 'ClientCodeName', ParameterValue: clientCodeName },
    { ParameterKey: 'SubDomain', ParameterValue: subDomain },
    { ParameterKey: 'Environment', ParameterValue: environment },
  ];

  if (domainName) t00Params.push({ ParameterKey: 'DomainName', ParameterValue: domainName });
  if (hostedZoneId) t00Params.push({ ParameterKey: 'HostedZoneId', ParameterValue: hostedZoneId });

  const t00Outputs = await runTemplate('./infra/CD/t00.cf.yaml', 'Israel-elections-code-bucket', t00Params);
  const distributionId = t00Outputs?.find(o => o.OutputKey === 'DistributionId')?.OutputValue;

  if (!distributionId) throw new Error('Missing DistributionId output');

  await uploadFiles(distributionId);

  await runTemplate(
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

  console.log('Deployment completed successfully!');
}

main().catch(err => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
