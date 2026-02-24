import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';

const cf = new CloudFrontClient({});

export async function invalidCache(files: string[], distributionID: string) {
  await cf.send(new CreateInvalidationCommand({
    InvalidationBatch: {
      CallerReference: Math.random().toString(),
      Paths: {
        Quantity: files.length,
        Items: files,
      },
    },
    DistributionId: distributionID,
  }));
}

export default {
  invalidCache,
};
