import {
  CloudFrontClient,
  CreateInvalidationCommand,
  GetInvalidationCommand,
} from '@aws-sdk/client-cloudfront';
import { promisify } from 'util';
import fs from 'fs/promises';

const cf = new CloudFrontClient({});
const setTimoutPromise = promisify(setTimeout);

const distributionID = process.argv[2] ?? '';

const getInvalidationStatus = (id: string) => cf.send(new GetInvalidationCommand(
  { DistributionId: distributionID, Id: id },
));

const main = async () => {
  if (!distributionID) {
    throw new Error('Missing distribution id');
  }

  let files: string[];
  try {
    const data = await fs.readFile('updated-files.json', 'utf8');
    files = JSON.parse(data);
  } catch {
    console.log('No updated-files.json found, skipping smart invalidation.');
    return;
  }

  if (files.length === 0) {
    console.log('No files changed, skipping invalidation.');
    return;
  }

  console.log(`Invalidating ${files.length} files...`);

  const { Invalidation } = await cf.send(new CreateInvalidationCommand({
    InvalidationBatch: {
      CallerReference: Math.random().toString(),
      Paths: {
        Quantity: files.length,
        Items: files,
      },
    },
    DistributionId: distributionID,
  }));
  if (!Invalidation || !Invalidation.Id) {
    throw new Error('Invalidation is null');
  }
  let invalidationStatus = await getInvalidationStatus(Invalidation.Id);
  if (!invalidationStatus?.Invalidation) {
    throw new Error('Invalidation status is null');
  }
  while (invalidationStatus.Invalidation.Status !== 'Completed') {
    await setTimoutPromise(10000);
    invalidationStatus = await getInvalidationStatus(Invalidation.Id);
    if (!invalidationStatus?.Invalidation) {
      throw new Error('Invalidation status is null');
    }
  }

  await fs.unlink('updated-files.json').catch(() => {});

  return invalidationStatus.Invalidation;
};

main().then(console.log);
