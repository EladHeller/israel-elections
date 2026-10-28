const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// A failed status write is a failed run: silence must never look healthy.
async function runWithHeartbeat(work, write, now = () => new Date().toISOString()) {
  const startedAt = now();
  await write('last-attempt.json', { startedAt, status: 'running' });
  try {
    const result = await work();
    const completed = { startedAt, finishedAt: now(), status: 'success', ...result };
    await write('last-success.json', completed);
    await write('last-attempt.json', completed);
    return completed;
  } catch (error) {
    // Keep diagnostics private and bounded. Never include CSV contents or environment.
    try {
      await write('last-attempt.json', { startedAt, finishedAt: now(), status: 'failed', error: String(error.message).slice(0, 2000) });
    } catch (statusError) { console.error('Failed to record crawler failure', statusError); }
    throw error;
  }
}

function statusWriter(env = process.env) {
  if (!env.CRAWLER_STATUS_BUCKET) throw new Error('CRAWLER_STATUS_BUCKET is required');
  const client = new S3Client({ region: 'il-central-1', maxAttempts: 3 });
  return (Key, value) => client.send(new PutObjectCommand({
    Bucket: env.CRAWLER_STATUS_BUCKET, Key, Body: JSON.stringify(value),
    ContentType: 'application/json', CacheControl: 'no-store',
  }), { abortSignal: AbortSignal.timeout(10_000) });
}
module.exports = { runWithHeartbeat, statusWriter };
