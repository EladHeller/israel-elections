import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { isDeepStrictEqual } from 'node:util';
import config from './config';
import { isRecord, isVoteData } from './types';

const s3 = new S3Client({ region: config.region });

function isMissingObject(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('$metadata' in error)) return false;
  const metadata = error.$metadata;
  return isRecord(metadata) && metadata.httpStatusCode === 404;
}

/** A pre-election source may be empty, but must never erase published counts. */
export async function assertCanPublishEmptyResults(key: string): Promise<void> {
  let response;
  try {
    response = await s3.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
  } catch (error) {
    if (isMissingObject(error)) return;
    throw error;
  }
  // Unreadable stored results are an error, not permission to overwrite them.
  if (!response.Body) throw new Error('Stored results body is missing');
  const stored: unknown = JSON.parse(await response.Body.transformToString());
  if (!isRecord(stored) || !isVoteData(stored.voteData)
    || (stored.countedVotes != null && typeof stored.countedVotes !== 'number')) {
    throw new Error('Invalid stored results');
  }
  if ((stored.countedVotes ?? 0) > 0 || Object.values(stored.voteData).some(party => party.votes > 0)) {
    throw new Error('Empty results CSV cannot replace published votes');
  }
}

export async function resultsMatch(key: string, expected: unknown): Promise<boolean> {
  let response;
  try {
    response = await s3.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
  } catch (error) {
    if (isMissingObject(error)) return false;
    throw error;
  }
  try {
    if (!response.Body) return false;
    const stored: unknown = JSON.parse(await response.Body.transformToString());
    if (!isRecord(stored)) return false;
    const { time: _time, ...results } = stored;
    // Compare the persisted JSON shape, which omits undefined optional fields.
    return isDeepStrictEqual(results, JSON.parse(JSON.stringify(expected)));
  } catch {
    return false;
  }
}
