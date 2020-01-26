const {CloudFront} = require('aws-sdk');
const {promisify} = require('util');
const fs = require('fs').promises;
const {distributionID} = require('./config');

const cf = new CloudFront();
const batch = Math.random().toString();
const setTimoutPromise = promisify(setTimeout);
const flat = arr => [].concat(...arr);

const getAllDirsFiles = (files, basePath) => Promise.all(files.flatMap(async file => {
  const currPath = basePath ? `${basePath}/${file}` : file;
  const stat = await fs.lstat(currPath);
  if (stat.isDirectory()) {
    const dirFiles = await fs.readdir(currPath);
    return getAllDirsFiles(dirFiles, currPath);
  }

  return currPath.replace(basePath, '');
}));


const getInvalidationStatus = id => cf.getInvalidation(
  {DistributionId: distributionID, Id: id},
).promise();

const main = async () => {
  const basePath = './elections-client';
  const files = flat(await getAllDirsFiles([basePath]));
  const {Invalidation} = await cf.createInvalidation({
    InvalidationBatch: {
      CallerReference: batch,
      Paths: {
        Quantity: files.length,
        Items: files,
      },
    },
    DistributionId: distributionID,
  }).promise();
  console.log({Invalidation});
  let invalidationStatus = await getInvalidationStatus(Invalidation.Id);
  while (invalidationStatus.Invalidation.Status !== 'Completed') {
    console.log(invalidationStatus.Invalidation.Status);
    await setTimoutPromise(10000);
    invalidationStatus = await getInvalidationStatus(Invalidation.Id);
  }
  return invalidationStatus.Invalidation;
};


main().then(console.log).catch(console.error);
