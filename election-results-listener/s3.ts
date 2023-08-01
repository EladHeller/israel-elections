import crypto from 'crypto';
import path from 'path';
import mime from 'mime-types';
import { S3 } from 'aws-sdk'; // eslint-disable-line import/no-extraneous-dependencies
import config from './config';

const { bucket, region } = config;

const s3 = new S3({ region });

const md5 = (data: Buffer) => crypto.createHash('md5').update(data).digest('hex');

export async function isFileAlreadyExists(key: string, stream: Buffer) {
  try {
    const { ETag, ContentLength } = await s3.headObject({ Bucket: bucket, Key: key }).promise();
    const equal = stream.length === ContentLength;
    if (!equal) {
      return false;
    }
    return md5(stream) === JSON.parse(ETag ?? '""');
  } catch (e) {
    return false;
  }
}

export async function upload(key: string, body: string) {
  return s3.upload({
    Bucket: bucket,
    Key: key,
    ACL: 'public-read',
    ContentType: mime.contentType(path.extname(key)) || 'application/octet-stream',
    Body: body,
  }).promise();
}
