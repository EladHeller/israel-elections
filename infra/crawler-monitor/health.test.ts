import { test } from 'node:test';
import assert from 'node:assert/strict';
const { evaluate } = require('./health.cjs');
const { createHandler } = require('./index.cjs');
const { runWithHeartbeat, statusWriter } = require('../ec2-crawler/heartbeat.cjs');

const minute = 60_000;
const base = Date.parse('2026-10-28T12:00:00Z');
const success = (time: number) => ({ status: 'success', finishedAt: new Date(time).toISOString() });

test('opens only after two stale checks and never closes for one isolated recovery', () => {
  let state = evaluate(null, success(base), base + 5 * minute);
  assert.equal(state.incident, false);
  state = evaluate(state, success(base), base + 6 * minute);
  assert.equal(state.incident, false);
  state = evaluate(state, success(base), base + 7 * minute);
  assert.equal(state.incident, true);
  state = evaluate(state, success(base + 8 * minute), base + 8 * minute);
  assert.equal(state.incident, true);
  state = evaluate(state, success(base + 8 * minute), base + 9 * minute);
  assert.equal(state.good, 1, 'repeated reads of one success do not recover');
  state = evaluate(state, success(base + 10 * minute), base + 10 * minute);
  state = evaluate(state, success(base + 11 * minute), base + 11 * minute);
  assert.equal(state.incident, false);
  state = evaluate(state, null, base + 12 * minute);
  state = evaluate(state, null, base + 13 * minute);
  assert.equal(state.incident, true, 'a later separate incident can alert again');
});

test('missing, failed, invalid and future success records all become unhealthy', () => {
  for (const record of [null, {}, { status: 'failed' }, { status: 'success', finishedAt: 'bad' }, success(base + 10 * minute)]) {
    const first = evaluate(null, record, base);
    assert.equal(evaluate(first, record, base + minute).incident, true);
  }
});

test('duplicate invocations do not advance bad or recovery counters', () => {
  const state = evaluate(null, null, base);
  assert.deepEqual(evaluate(state, null, base + 1000), state);
  assert.equal(evaluate(state, null, base + minute).incident, true);
});

test('a long outage stays one incident until stable recovery', () => {
  let state = null;
  let transitions = 0;
  for (let i = 0; i < 60; i++) {
    const next = evaluate(state, null, base + i * minute);
    if (next.incident !== (state?.incident ?? false)) transitions++;
    state = JSON.parse(JSON.stringify(next)); // survives new Lambda instances
  }
  assert.equal(transitions, 1);
  assert.equal(state.incident, true);
});

test('fresh unchanged results stay healthy', () => {
  let state = null;
  for (let i = 0; i < 20; i++) {
    state = evaluate(state, { ...success(base + i * minute), sha256: 'same' }, base + i * minute);
    assert.equal(state.incident, false);
  }
});

test('monitor reads diagnostics, persists state before emitting health and reports failures', async () => {
  const order: string[] = [];
  let stored = null;
  const handler = createHandler({
    read: async (key: string) => key === 'monitor-state.json' ? stored : key === 'last-success.json' ? success(base) : { status: 'running' },
    write: async (state: unknown) => { order.push('write'); stored = state; },
    metric: async (value: number) => { order.push('metric:' + value); }, now: () => base,
  });
  const unhealthy = createHandler({ read: async () => ({ incident: true, checkedAt: base }), write: async () => {}, metric: async (value: number) => { assert.equal(value, 1); }, now: () => base });
  await unhealthy();
  const report = await handler();
  assert.equal(report.lastAttempt.status, 'running');
  assert.deepEqual(order, ['write', 'metric:0']);
  await handler();
  assert.equal(stored.good, 1);
  for (const fail of ['read', 'write', 'metric']) {
    const h = createHandler({ read: async () => null, write: async () => {}, metric: async () => {},
      [fail]: async () => { throw new Error(fail); }, now: () => base });
    await assert.rejects(h(), new RegExp(fail));
  }
});

test('heartbeat records start then success even for unchanged data', async () => {
  const writes: [string, any][] = [];
  const result = await runWithHeartbeat(async () => ({ sha256: 'same', rows: 1181 }), async (key: string, value: unknown) => { writes.push([key, value]); }, () => new Date(base).toISOString());
  assert.deepEqual(writes.map(([key]) => key), ['last-attempt.json', 'last-success.json', 'last-attempt.json']);
  assert.equal(writes[0][1].status, 'running');
  assert.equal(result.status, 'success');
  assert.equal(result.rows, 1181);
});

test('failed work records error but never advances success', async () => {
  const writes: [string, any][] = [];
  await assert.rejects(runWithHeartbeat(async () => { throw new Error('download failed'); }, async (key: string, value: unknown) => { writes.push([key, value]); }), /download failed/);
  assert.deepEqual(writes.map(([key]) => key), ['last-attempt.json', 'last-attempt.json']);
  assert.equal(writes[1][1].status, 'failed');
  assert.equal(writes[1][1].error, 'download failed');
});

test('heartbeat write failures remain failed runs and do not hide the original error', async () => {
  let worked = false;
  await assert.rejects(runWithHeartbeat(async () => { worked = true; }, async () => { throw new Error('S3 down'); }), /S3 down/);
  assert.equal(worked, false);
  await assert.rejects(runWithHeartbeat(async () => { throw new Error('original'); }, async (_key: string, record: any) => { if (record.status === 'failed') throw new Error('secondary'); }), /original/);
  await assert.rejects(runWithHeartbeat(async () => ({}), async (key: string) => { if (key === 'last-success.json') throw new Error('S3 down'); }), /S3 down/);
  assert.throws(() => statusWriter({}), /required/);
});

test('real S3 and metric adapters handle missing objects and propagate other errors', async t => {
  const { S3Client } = require('@aws-sdk/client-s3');
  const { CloudWatchClient } = require('@aws-sdk/client-cloudwatch');
  const { handler } = require('./index.cjs');
  const sent: any[] = [];
  const originalS3 = S3Client.prototype.send;
  const originalCW = CloudWatchClient.prototype.send;
  const oldBucket = process.env.STATUS_BUCKET;
  process.env.STATUS_BUCKET = 'private-status';
  t.after(() => {
    S3Client.prototype.send = originalS3;
    CloudWatchClient.prototype.send = originalCW;
    if (oldBucket === undefined) delete process.env.STATUS_BUCKET; else process.env.STATUS_BUCKET = oldBucket;
  });
  let failure = 'NoSuchKey';
  S3Client.prototype.send = async function(command: any) {
    sent.push(command.input);
    if (command.constructor.name === 'GetObjectCommand') {
      if (failure) throw Object.assign(new Error(failure), { name: failure });
      return { Body: { transformToString: async () => JSON.stringify(success(Date.now())) } };
    }
    return {};
  };
  CloudWatchClient.prototype.send = async function(command: any) { sent.push(command.input); };
  await handler();
  assert.ok(sent.some(input => input.Key === 'monitor-state.json' && input.Body));
  assert.ok(sent.some(input => input.Namespace === 'IsraelElections/Crawler'));
  failure = '';
  await handler();
  failure = 'AccessDenied';
  await assert.rejects(handler(), /AccessDenied/);
  const write = statusWriter({ CRAWLER_STATUS_BUCKET: 'private-status' });
  await write('last-attempt.json', { status: 'running' });
  assert.ok(sent.some(input => input.Bucket === 'private-status' && input.CacheControl === 'no-store'));
});
