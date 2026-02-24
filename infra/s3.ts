import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import { S3Client, HeadObjectCommand, ObjectCannedACL } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import mime from 'mime-types';

const region = process.env.REGION;

const s3 = new S3Client({ region });

const chunk = 1024 * 1024 * 5; // 5MB

const md5 = (data: Buffer) => crypto.createHash('md5').update(data).digest('hex');

const flat = (arr: any[]) => [].concat(...arr);

export interface FileData {
  file: string;
  size: number;
}

export async function getAllDirsFiles(files: string[], basePath?: string): Promise<FileData[]> {
  return flat(await Promise.all(
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
}

async function getEtagOfFile(stream: Buffer): Promise<string> {
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

export async function upload(bucket: string, key: string, filePath: string, acl: ObjectCannedACL = 'private') {
  const s3Object = await s3.send(new HeadObjectCommand({
    Bucket: bucket,
    Key: key,
  })).catch(() => ({ ContentLength: 0, ETag: '""' }));
  const file = await fs.readFile(filePath);
  const etag = await getEtagOfFile(file);
  if (etag === JSON.parse(s3Object.ETag ?? '""')) {
    console.log(`${key} already up to date`);
    return;
  }

  const contentType = mime.contentType(path.extname(key));

  const parallelUploads3 = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: key,
      Body: file,
      ContentType: typeof contentType === 'string' ? contentType : 'application/octet-stream',
      ACL: acl,
    },
  });

  await parallelUploads3.done();

  console.log(`${key} updated`);
}
