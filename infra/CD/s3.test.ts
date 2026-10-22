import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getAllDirsFiles, upload } from '../../dist/infra/s3.js';

const md5 = (body: Buffer) => createHash('md5').update(body).digest('hex');

test('file discovery includes nested files and handles empty directories and explicit base paths', async context => {
  const dir = await mkdtemp(join(tmpdir(), 'elections-files-'));
  context.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'nested'));
  await mkdir(join(dir, 'empty'));
  await writeFile(join(dir, 'index.html'), 'hello');
  await writeFile(join(dir, 'nested', 'results.json'), '{}');
  const expected = [
    { file: join(dir, 'index.html'), size: 5 },
    { file: join(dir, 'nested', 'results.json'), size: 2 },
  ];
  assert.deepEqual((await getAllDirsFiles([dir])).sort((a, b) => a.file.localeCompare(b.file)), expected);
  assert.deepEqual(await getAllDirsFiles(['index.html'], dir), [expected[0]]);
  assert.deepEqual(await getAllDirsFiles([]), []);
  await assert.rejects(getAllDirsFiles([join(dir, 'missing')]), { code: 'ENOENT' });
});

test('normal deployment uploads changed files with their metadata and skips unchanged S3 objects', async context => {
  const dir = await mkdtemp(join(tmpdir(), 'elections-upload-'));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'fixture');
  const body = Buffer.from('{"countedVotes":1000000}');
  await writeFile(file, body);
  let remote: { ETag?: string } = { ETag: JSON.stringify(md5(body)) };
  let missing = false;
  context.mock.method(S3Client.prototype, 'send', async command => {
    assert.ok(command instanceof HeadObjectCommand);
    assert.deepEqual(command.input, { Bucket: 'dev', Key: currentKey });
    if (missing) throw new Error('Not found');
    return remote;
  });
  const uploads: Record<string, unknown>[] = [];
  context.mock.method(Upload.prototype, 'done', async function () {
    uploads.push((this as unknown as { params: Record<string, unknown> }).params);
    return {};
  });
  let currentKey = 'test-data/live-results.json';
  assert.equal(await upload('dev', currentKey, file), false);
  assert.equal(uploads.length, 0);

  remote = { ETag: '"old"' };
  assert.equal(await upload('dev', currentKey, file, 'public-read'), true);
  assert.deepEqual(uploads[0], {
    Bucket: 'dev', Key: currentKey, Body: body, ContentType: 'application/json; charset=utf-8', ACL: 'public-read',
  });

  remote = {};
  currentKey = 'test-data/live-results.csv';
  assert.equal(await upload('dev', currentKey, file), true);
  assert.equal(uploads[1].ContentType, 'text/csv; charset=utf-8');

  missing = true;
  currentKey = 'unknown-extension';
  assert.equal(await upload('dev', currentKey, file), true);
  assert.equal(uploads[2].ContentType, 'application/octet-stream');
  assert.deepEqual(uploads[2].Body, body);

  const denied = new Error('S3 upload failed');
  context.mock.method(Upload.prototype, 'done', async () => { throw denied; });
  await assert.rejects(upload('dev', currentKey, file), denied);
});

test('deduplication recognizes single-part boundary and multipart S3 ETags', async context => {
  const dir = await mkdtemp(join(tmpdir(), 'elections-etag-'));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'large.zip');
  const partSize = 5 * 1024 * 1024;
  let etag: string;
  context.mock.method(S3Client.prototype, 'send', async () => ({ ETag: JSON.stringify(etag) }));
  const done = context.mock.method(Upload.prototype, 'done', async () => ({}));
  const boundary = Buffer.alloc(partSize, 'a');
  await writeFile(file, boundary);
  etag = md5(boundary);
  assert.equal(await upload('dev', 'boundary.zip', file), false);

  const parts = [Buffer.alloc(partSize, 'a'), Buffer.alloc(partSize, 'b'), Buffer.from('last part')];
  await writeFile(file, Buffer.concat(parts));
  etag = `${md5(Buffer.from(parts.map(md5).join(''), 'hex'))}-3`;
  assert.equal(await upload('dev', 'multipart.zip', file), false);
  assert.equal(done.mock.callCount(), 0);
  etag = 'stale';
  assert.equal(await upload('dev', 'multipart.zip', file), true);
  assert.equal(done.mock.callCount(), 1);
});

test('conditional initialization sets a binary fallback MIME type and propagates unexpected errors', async context => {
  let reason: unknown;
  let reject = false;
  context.mock.method(S3Client.prototype, 'send', async command => {
    assert.ok(command instanceof PutObjectCommand);
    assert.equal(command.input.ContentType, 'application/octet-stream');
    assert.equal(command.input.IfNoneMatch, '*');
    if (reject) throw reason;
    return {};
  });
  assert.equal(await upload('dev', 'no-extension', 'package.json', undefined, true), true);
  reject = true;
  for (reason of [null, {}, { $metadata: {} }, new Error('network failure')]) {
    await assert.rejects(upload('dev', 'no-extension', 'package.json', undefined, true), error => error === reason);
  }
  await assert.rejects(upload('dev', 'no-extension', '/missing-election-seed', undefined, true), { code: 'ENOENT' });
});
