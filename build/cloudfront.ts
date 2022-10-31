/* eslint-disable no-await-in-loop */
/* eslint-disable import/no-extraneous-dependencies */
import { CloudFront } from 'aws-sdk';
import { promisify } from 'util';
import fs from 'fs/promises';

const cf = new CloudFront();
const batch = Math.random().toString();
const setTimoutPromise = promisify(setTimeout);

const distributionID = process.env.DISTRIBUTION_ID ?? '';
const flat = (arr: any[]) => [].concat(...arr);

const getAllDirsFiles = async (files: string[], basePath: string = '') => flat(await Promise.all(
  files.flatMap(async (file) => {
    const currPath = basePath ? `${basePath}/${file}` : file;
    const stat = await fs.lstat(currPath);
    if (stat.isDirectory()) {
      const dirFiles = await fs.readdir(currPath);
      return getAllDirsFiles(dirFiles, currPath);
    }

    return currPath.replace(basePath, '');
  }),
));

const getInvalidationStatus = (id: string) => cf.getInvalidation(
  { DistributionId: distributionID, Id: id },
).promise();

const main = async () => {
  if (!distributionID) {
    throw new Error('Missing distribution id');
  }
  const basePath = './elections-client';
  const files = await getAllDirsFiles([basePath]);
  const { Invalidation } = await cf.createInvalidation({
    InvalidationBatch: {
      CallerReference: batch,
      Paths: {
        Quantity: files.length,
        Items: files,
      },
    },
    DistributionId: distributionID,
  }).promise();
  if (!Invalidation) {
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
  return invalidationStatus.Invalidation;
};

main().then(console.log);
