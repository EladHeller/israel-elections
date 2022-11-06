/* eslint-disable import/no-extraneous-dependencies */
import { CloudFormation } from 'aws-sdk';
import 'dotenv/config';
import fs from 'fs/promises';

import { exec } from 'child_process';

const region = process.env.REGION;
const bucketCodeName = process.env.CODE_BUCKET;
const clientCodeName = process.env.CLIENT_CODE_BUCKET;
const currElections = process.env.CURR_ELECTIONS;

const cf = new CloudFormation({ region });

async function runTemplate(
  templatePath: string,
  name: string,
  parameters?: CloudFormation.Parameters,
  capabilities?: CloudFormation.Capabilities,
) {
  const stack = await cf.describeStacks({
    StackName: name,
  }).promise().catch(() => ({ Stacks: [] }));
  const template = await fs.readFile(templatePath, 'utf-8');
  const newStack = stack.Stacks != null && stack.Stacks.length < 1;
  console.log({ newStack });
  if (newStack) {
    await cf.createStack({
      StackName: name,
      TemplateBody: template,
      Capabilities: capabilities,
      Parameters: parameters,
    }).promise();
  } else {
    try {
      await cf.updateStack({
        StackName: name,
        TemplateBody: template,
        Capabilities: capabilities,
        Parameters: parameters,
      }).promise();
    } catch (e) {
      if (e.message === 'No updates are to be performed.') {
        console.log(`template ${name} No updates are to be performed.`);
        return null;
      }
      throw e;
    }
  }

  const { $response: { data, error } } = await Promise.race([
    cf.waitFor('stackCreateComplete', { StackName: name }).promise(),
    cf.waitFor('stackUpdateComplete', { StackName: name }).promise(),
    cf.waitFor('stackRollbackComplete', { StackName: name }).promise(),
  ]);
  if (error || !data
     || !['CREATE_COMPLETE', 'UPDATE_COMPLETE'].includes(data.Stacks?.[0]?.StackStatus ?? '')) {
    console.log(error, data);
    throw new Error('Creation failed');
  }
  console.log(`template ${name} ${newStack ? 'created' : 'updated'}.`);
  return stack.Stacks?.[0].Outputs ?? data.Stacks?.[0].Outputs;
}

async function main() {
  const outputs = await runTemplate('./build/t00.cf.yaml', 'Israel-elections-code-bucket', [{
    ParameterKey: 'BucketCodeName',
    ParameterValue: bucketCodeName,
  }, {
    ParameterKey: 'ClientCodeName',
    ParameterValue: clientCodeName,
  }]);
  const distributionId = outputs?.find(({ OutputKey }) => OutputKey === 'DistributionId')?.OutputValue;

  await new Promise((resolve, reject) => {
    exec(`sh ./build/deploy.sh ${distributionId}`, (error, stdout, stderr) => {
      console.log(error, stdout, stderr);
      if (error) {
        reject(stderr);
      } else {
        resolve(stdout);
      }
    });
  });

  await runTemplate(
    './build/t01.cf.yaml',
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
