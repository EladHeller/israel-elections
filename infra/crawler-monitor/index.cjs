const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
const { evaluate } = require('./health.cjs');
const s3 = new S3Client({ maxAttempts: 3 });
const cloudwatch = new CloudWatchClient({ maxAttempts: 3 });

function createHandler({ read, write, metric, now = Date.now }) {
  return async () => {
    // Access denied, malformed JSON and network errors must fail the invocation;
    // only a genuinely absent object is interpreted as no heartbeat/state yet.
    const [previous, success, attempt] = await Promise.all([
      read('monitor-state.json'), read('last-success.json'), read('last-attempt.json'),
    ]);
    const state = evaluate(previous, success, now());
    const report = { ...state, lastSuccess: success, lastAttempt: attempt };
    await write(state);
    // Emitted only after all checks and persistence succeed. Missing metrics alarm too.
    await metric(state.incident ? 1 : 0);
    console.log(JSON.stringify(report));
    return report;
  };
}

const handler = createHandler({
  read: async Key => {
    try {
      const output = await s3.send(new GetObjectCommand({ Bucket: process.env.STATUS_BUCKET, Key }));
      return JSON.parse(await output.Body.transformToString());
    } catch (error) {
      if (error.name === 'NoSuchKey') return null;
      throw error;
    }
  },
  write: state => s3.send(new PutObjectCommand({ Bucket: process.env.STATUS_BUCKET, Key: 'monitor-state.json', Body: JSON.stringify(state), ContentType: 'application/json' })),
  metric: Value => cloudwatch.send(new PutMetricDataCommand({ Namespace: 'IsraelElections/Crawler', MetricData: [{ MetricName: 'Unhealthy', Value, Unit: 'Count' }] })),
});
module.exports = { handler, createHandler };
