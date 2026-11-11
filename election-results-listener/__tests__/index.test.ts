import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calcOldElectionsResults, handler } from '../../dist/index.js';

test('calculation handler accepts valid vote data and optional defaults', async () => {
  const voteData = { a: { votes: 100 }, b: { votes: 50 } };
  const result = await handler({ body: JSON.stringify({ voteData, blockPercentage: null, agreements: [] }) });
  assert.equal(result?.statusCode, 200);
  const { realResults } = JSON.parse(result.body);
  assert.equal(realResults.a.mandats, 80);
  assert.equal(realResults.b.mandats, 40);
});

test('calculation handler returns its error response for malformed input', async context => {
  context.mock.method(console, 'error', () => {});
  for (const body of [undefined, 'null', '{"voteData":{"a":{"votes":"100"}}}', '{"voteData":{},"agreements":[3]}']) {
    assert.equal((await handler({ body }))?.statusCode, 500);
  }
});

test('historical calculation rejects elections without embedded votes', async () => {
  await assert.rejects(calcOldElectionsResults(26), /No historical vote data/);
});
