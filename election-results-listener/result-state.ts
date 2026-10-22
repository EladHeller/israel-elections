import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { isDeepStrictEqual } from 'node:util';
import config from './config';

const s3 = new S3Client({ region: config.region });

export async function resultsMatch(key: string, expected: unknown): Promise<boolean> {
  let response;
  try {
    response = await s3.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404) return false;
    throw error;
  }
  try {
    const { time: _time, ...results } = JSON.parse(await response.Body!.transformToString());
    return isDeepStrictEqual(results, expected);
  } catch {
    return false;
  }
}
