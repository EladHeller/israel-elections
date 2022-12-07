/*  eslint-disable import/no-extraneous-dependencies */
import { Lambda } from 'aws-sdk';

const region = process.env.REGION;
const bucketCodeName = process.env.CODE_BUCKET;

const lambda = new Lambda({ region });

async function main() {
  if (!bucketCodeName) {
    throw new Error('Bucket code variable is empty!');
  }

  await lambda.updateFunctionCode({
    FunctionName: 'Israel-elections-function',
    S3Bucket: bucketCodeName,
    S3Key: 'dist.zip',
  }).promise();
}

main();
