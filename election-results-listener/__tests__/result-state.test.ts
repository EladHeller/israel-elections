import assert from 'node:assert/strict';
import { test } from 'node:test';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { resultsMatch } from '../../dist/result-state.js';

test('stored result comparison ignores timestamps and object key order but detects stale or reset data', async context => {
  let stored = '{"time":"old","countedVotes":154,"voteData":{"a":{"votes":150}}}';
  context.mock.method(S3Client.prototype, 'send', async command => {
    assert.ok(command instanceof GetObjectCommand);
    assert.equal(command.input.Key, 'data/26/allResults.json');
    return { Body: { transformToString: async () => stored } };
  });
  const expected = { voteData: { a: { votes: 150 } }, countedVotes: 154 };
  assert.equal(await resultsMatch('data/26/allResults.json', expected), true);
  for (stored of ['{"countedVotes":0}', '{}', 'null', 'invalid json']) {
    assert.equal(await resultsMatch('data/26/allResults.json', expected), false);
  }
  stored = '{"voteData":{"a":{"votes":150}}}';
  assert.equal(await resultsMatch('data/26/allResults.json', { voteData: expected.voteData, countedVotes: undefined }), true);
});

test('missing results can be repaired but S3 access and network failures propagate', async context => {
  let reason: unknown = { $metadata: { httpStatusCode: 404 } };
  context.mock.method(S3Client.prototype, 'send', async () => { throw reason; });
  assert.equal(await resultsMatch('missing', {}), false);
  for (reason of [null, {}, { $metadata: {} }, { $metadata: { httpStatusCode: 403 } }, new Error('network')]) {
    await assert.rejects(resultsMatch('missing', {}), error => error === reason);
  }
});

test('missing or unreadable response bodies require rebuilding the results', async context => {
  const stub = context.mock.method(S3Client.prototype, 'send', async () => ({}));
  assert.equal(await resultsMatch('empty', {}), false);
  stub.mock.mockImplementation(async () => ({ Body: { transformToString: async () => { throw new Error('incomplete stream'); } } }));
  assert.equal(await resultsMatch('empty', {}), false);
});
