import crypto from 'crypto';
import path from 'path';
import mime from 'mime-types';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import config from './config';

const { bucket, region } = config;

const s3 = new S3Client({ region });

const md5 = (data: Buffer) => crypto.createHash('md5').update(data).digest('hex');

export async function isFileAlreadyExists(key: string, stream: Buffer) {
  try {
    const { ETag, ContentLength } = await s3.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    const equal = stream.length === ContentLength;
    if (!equal) {
      return false;
    }
    return md5(stream) === JSON.parse(ETag ?? '""');
  } catch {
    return false;
  }
}

export async function upload(key: string, body: string) {
  const parallelUploads3 = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: key,
      ACL: 'public-read',
      ContentType: mime.contentType(path.extname(key)) || 'application/octet-stream',
      Body: body,
    },
  });

  return parallelUploads3.done();
}
