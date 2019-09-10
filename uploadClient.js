const {S3} = require('aws-sdk');
const fs = require('fs');
const mime = require('mime-types');
const path = require('path');
const {promisify} = require('util');
const {region} = require('./config');

const s3 = new S3({region});
const flat = arr => [].concat(...arr);

const lstat = promisify(fs.lstat);
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);

const getAllDirsFiles = (files, basePath) => Promise.all(files.map(async (file) => {
  const currPath = basePath ? `${basePath}/${file}` : file;
  const stat = await lstat(currPath);
  if (stat.isDirectory()) {
    const dirFiles = await readdir(currPath);
    return flat(await getAllDirsFiles(dirFiles, currPath));
  }

  return {file: currPath, size: stat.size};
}));

const upload = async (key, body) => s3.upload({
  Bucket: 'elections-client',
  Key: key,
  ACL: 'public-read',
  ContentType: mime.contentType(path.extname(key)) || 'application/octet-stream',
  Body: body,
}).promise();
const main = async () => {
  const basePath = './elections-client';
  const files = flat(await getAllDirsFiles([basePath]));
  // eslint-disable-next-line no-restricted-syntax
  await Promise.all(files.map(async ({file}) => {
    await upload(file.replace(`${basePath}/`, ''), await readFile(file));
  }));
};

main().then(console.log).catch(console.error);
