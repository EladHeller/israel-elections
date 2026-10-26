import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { isDeepStrictEqual } from 'node:util';
import config from './config';

const s3 = new S3Client({ region: config.region });

/** A pre-election source may be empty, but must never erase published counts. */
export async function assertCanPublishEmptyResults(key: string): Promise<void> {
  let response;
  try {
    response = await s3.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404) return;
    throw error;
  }
  // Unreadable stored results are an error, not permission to overwrite them.
  const stored = JSON.parse(await response.Body!.transformToString());
  if (stored.countedVotes > 0 || Object.values(stored.voteData).some((party: { votes: number }) => party.votes > 0)) {
    throw new Error('Empty results CSV cannot replace published votes');
  }
}

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
    // Compare the persisted JSON shape, which omits undefined optional fields.
    return isDeepStrictEqual(results, JSON.parse(JSON.stringify(expected)));
  } catch {
    return false;
  }
}
