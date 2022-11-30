/* eslint-disable import/no-extraneous-dependencies */
import { S3 } from 'aws-sdk';
import 'dotenv/config';
import fs from 'fs/promises';
import crypto from 'crypto';
import { ObjectCannedACL } from 'aws-sdk/clients/s3';
import mime from 'mime-types';
import path from 'path';

const region = process.env.REGION;
const bucketCodeName = process.env.CODE_BUCKET;
const clientCodeName = process.env.CLIENT_CODE_BUCKET;

const s3 = new S3({ region });

const chunk = 1024 * 1024 * 5; // 5MB

const md5 = (data: Buffer) => crypto.createHash('md5').update(data).digest('hex');

interface FileData {
  file: string;
  size: number;
}

const flat = (arr: any[]) => [].concat(...arr);

const getAllDirsFiles = async (files: string[], basePath?: string) => flat(await Promise.all(
  files.flatMap(async (file) => {
    const currPath = basePath ? `${basePath}/${file}` : file;
    const stat = await fs.lstat(currPath);
    if (stat.isDirectory()) {
      const dirFiles = await fs.readdir(currPath);
      return getAllDirsFiles(dirFiles, currPath);
    }

    return { file: currPath, size: stat.size };
  }),
));

async function getEtagOfFile(stream: Buffer) {
  if (stream.length <= chunk) {
    return md5(stream);
  }
  const md5Chunks: string[] = [];
  const chunksNumber = Math.ceil(stream.length / chunk);
  for (let i = 0; i < chunksNumber; i += 1) {
    const chunkStream = stream.slice(i * chunk, (i + 1) * chunk);
    md5Chunks.push(md5(chunkStream));
  }

  return `${md5(Buffer.from(md5Chunks.join(''), 'hex'))}-${chunksNumber}`;
}

async function upload(bucket: string, key: string, filePath: string, acl: ObjectCannedACL = 'private') {
  const s3Object = await s3.headObject({
    Bucket: bucket,
    Key: key,
  }).promise().catch(() => ({ ContentLength: '', ETag: '""' }));
  const file = await fs.readFile(filePath);
  const etag = await getEtagOfFile(file);
  if (etag === JSON.parse(s3Object.ETag ?? '""')) {
    console.log(`${key} already up to date`);
    return;
  }

  const contentType = mime.contentType(path.extname(key));

  await s3.upload({
    Bucket: bucket,
    Key: key,
    Body: file,
    ContentType: typeof contentType === 'string' ? contentType : 'application/octet-stream',
    ACL: acl,
  }).promise();

  console.log(`${key} updated`);
}

async function main() {
  if (!bucketCodeName || !clientCodeName) {
    throw new Error('Bucket code variable is empty!');
  }

  await upload(bucketCodeName, 'dist.zip', './dist.zip');

  const basePath = './elections-client';
  const files = await getAllDirsFiles([basePath]);
  // eslint-disable-next-line no-restricted-syntax
  await Promise.all(files.map(async ({ file }: FileData) => {
    console.log(file);
    await upload(
      clientCodeName,
      file.replace(`${basePath}/`, ''),
      file,
      'public-read',
    );
  }));
  console.log('finnish');

  await upload(clientCodeName, 'client.zip', './client.zip', 'public-read');
}

main();
