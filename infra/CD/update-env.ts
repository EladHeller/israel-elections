import {
  CloudFormationClient,
  DescribeStacksCommand,
  CreateStackCommand,
  UpdateStackCommand,
  waitUntilStackCreateComplete,
  waitUntilStackUpdateComplete,
  waitUntilStackRollbackComplete,
  Parameter,
  Capability,
} from '@aws-sdk/client-cloudformation';
import fs from 'fs/promises';

import { exec } from 'child_process';

const region = process.env.REGION;
const bucketCodeName = process.env.CODE_BUCKET;
const clientCodeName = process.env.CLIENT_CODE_BUCKET;
const currElections = process.env.CURR_ELECTIONS;

const cf = new CloudFormationClient({ region });

async function runTemplate(
  templatePath: string,
  name: string,
  parameters?: Parameter[],
  capabilities?: Capability[],
) {
  const stack = await cf.send(new DescribeStacksCommand({
    StackName: name,
  })).catch(() => ({ Stacks: [] }));
  console.log(stack.Stacks?.[0]?.Outputs);
  const template = await fs.readFile(templatePath, 'utf-8');
  const isNewStack = stack.Stacks != null && stack.Stacks.length < 1;
  console.log({ isNewStack });
  if (isNewStack) {
    await cf.send(new CreateStackCommand({
      StackName: name,
      TemplateBody: template,
      Capabilities: capabilities,
      Parameters: parameters,
    }));
  } else {
    try {
      await cf.send(new UpdateStackCommand({
        StackName: name,
        TemplateBody: template,
        Capabilities: capabilities,
        Parameters: parameters,
      }));
    } catch (e: any) {
      if (e.message === 'No updates are to be performed.') {
        console.log(`template ${name} No updates are to be performed.`);
        return stack.Stacks?.[0]?.Outputs;
      }
      throw e;
    }
  }

  await Promise.race([
    waitUntilStackCreateComplete({ client: cf, maxWaitTime: 1200 }, { StackName: name }),
    waitUntilStackUpdateComplete({ client: cf, maxWaitTime: 1200 }, { StackName: name }),
    waitUntilStackRollbackComplete({ client: cf, maxWaitTime: 1200 }, { StackName: name }),
  ]);

  const updatedStack = await cf.send(new DescribeStacksCommand({
    StackName: name,
  }));

  const status = updatedStack.Stacks?.[0]?.StackStatus;
  if (!['CREATE_COMPLETE', 'UPDATE_COMPLETE'].includes(status ?? '')) {
    console.log(updatedStack);
    throw new Error('Creation failed');
  }
  console.log(`template ${name} ${isNewStack ? 'created' : 'updated'}.`);
  return updatedStack.Stacks?.[0]?.Outputs;
}

async function main() {
  const outputs = await runTemplate('./infra/CD/t00.cf.yaml', 'Israel-elections-code-bucket', [{
    ParameterKey: 'BucketCodeName',
    ParameterValue: bucketCodeName,
  }, {
    ParameterKey: 'ClientCodeName',
    ParameterValue: clientCodeName,
  }]);
  const distributionId = outputs?.find(({ OutputKey }) => OutputKey === 'DistributionId')?.OutputValue;
  console.log({ distributionId, outputs });
  if (!distributionId) {
    throw new Error('Missing distribution id');
  }
  await new Promise((resolve, reject) => {
    exec(`sh ./infra/CD/deploy.sh ${distributionId}`, (error, stdout, stderr) => {
      console.log(error, stdout, stderr);
      if (error) {
        reject(stderr);
      } else {
        resolve(stdout);
      }
    });
  });

  await runTemplate(
    './infra/CD/t01.cf.yaml',
    'Israel-elections',
    [{
      ParameterKey: 'BucketCodeName',
      ParameterValue: bucketCodeName,
    }, {
      ParameterKey: 'ClientCodeName',
      ParameterValue: clientCodeName,
    }, {
      ParameterKey: 'Region',
      ParameterValue: region,
    }, {
      ParameterKey: 'CurrentElections',
      ParameterValue: currElections,
    }, {
      ParameterKey: 'DistributionId',
      ParameterValue: distributionId,
    }],
    ['CAPABILITY_NAMED_IAM'],
  );
}

main().then(() => {
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
