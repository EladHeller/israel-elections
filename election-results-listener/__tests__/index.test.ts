import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mock, test } from 'node:test';
import elections from '../config-elections.json';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const csvMonitor = mock.fn(async () => {});
const uploadResults = mock.fn(async (_results: unknown, _election: number) => {});
const load = Module._load;
const loader = mock.method(Module, '_load', function (request, parent, isMain) {
  if (request === './csv-monitor') return { csvMonitor, uploadResults };
  return load.call(this, request, parent, isMain);
});

let listener: typeof import('../index');
try {
  listener = require('../../dist/index.js');
} finally {
  loader.mock.restore();
}

test('scheduled events run the CSV monitor without a request body', async () => {
  await listener.handler({ source: 'aws.events' });
  assert.equal(csvMonitor.mock.callCount(), 1);
});

test('calculation handler accepts valid vote data and optional defaults', async () => {
  const voteData = { a: { votes: 100, mandats: 0 }, b: { votes: 50 } };
  for (const options of [{ blockPercentage: null }, { blockPercentage: 0.05, agreements: [['a', 'b']] }]) {
    const result = await listener.handler({ body: JSON.stringify({ voteData, ...options }) });
    assert.equal(result?.statusCode, 200);
    const { realResults } = JSON.parse(result.body);
    assert.equal(realResults.a.mandats, 80);
    assert.equal(realResults.b.mandats, 40);
  }
});

test('calculation handler returns its error response for malformed input', async context => {
  context.mock.method(console, 'error', () => {});
  const invalidBodies = [
    undefined, 'null', '{"voteData":{"a":{"votes":"100"}}}', '{"voteData":{"a":{"votes":1e309}}}',
    '{"voteData":{"a":{"votes":1,"mandats":"1"}}}', '{"voteData":{"a":null}}',
    '{"voteData":{},"blockPercentage":"0.05"}', '{"voteData":{},"agreements":{}}',
    '{"voteData":{},"agreements":[3]}', '{"voteData":{},"agreements":[["a",3]]}',
  ];
  for (const body of invalidBodies) {
    assert.equal((await listener.handler({ body }))?.statusCode, 500);
  }
});

test('historical calculation publishes the embedded votes and rejects elections without them', async () => {
  await assert.rejects(listener.calcOldElectionsResults(999), /No historical vote data/);
  await assert.rejects(listener.calcOldElectionsResults(26), /No historical vote data/);
  assert.equal(uploadResults.mock.callCount(), 0);
  await listener.calcOldElectionsResults(14);
  assert.equal(uploadResults.mock.callCount(), 1);
  const [results, election] = uploadResults.mock.calls[0].arguments;
  assert.equal(election, 14);
  assert.ok(results && typeof results === 'object' && 'voteData' in results);
  assert.deepEqual(results.voteData, elections['14'].voteData);
});
