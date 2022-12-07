import { CloudFront } from 'aws-sdk';// eslint-disable-line import/no-extraneous-dependencies

const cf = new CloudFront();

export async function invalidCache(files: string[], distributionID: string) {
  await cf.createInvalidation({
    InvalidationBatch: {
      CallerReference: Math.random().toString(),
      Paths: {
        Quantity: files.length,
        Items: files,
      },
    },
    DistributionId: distributionID,
  }).promise();
}

export default {
  invalidCache,
};
