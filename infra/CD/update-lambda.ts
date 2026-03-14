import { LambdaClient, UpdateFunctionCodeCommand } from '@aws-sdk/client-lambda';

const region = process.env.REGION;
const bucketCodeName = process.env.CODE_BUCKET;

const lambda = new LambdaClient({ region });

async function main() {
  if (!bucketCodeName) {
    throw new Error('Bucket code variable is empty!');
  }

  await lambda.send(new UpdateFunctionCodeCommand({
    FunctionName: 'Israel-elections-function',
    S3Bucket: bucketCodeName,
    S3Key: 'dist.zip',
  }));
}

main();
