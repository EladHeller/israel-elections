import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectAvailableElections, fetchElectionResults, LATEST_ELECTION_ID } from './data';

test('available elections are ordered newest first', async () => {
  assert.deepEqual(await detectAvailableElections(26, 24), ['26', '25', '24']);
  assert.equal((await detectAvailableElections())[0], String(LATEST_ELECTION_ID));
});

test('results use a root-relative URL so nested screen paths work', async (t) => {
  const payload = { voteData: {} };
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, '/data/25/allResults.json');
    assert.equal(options.cache, 'no-store');
    return { ok: true, json: async () => payload };
  });
  assert.deepEqual(await fetchElectionResults('25'), payload);
});

test('missing results remain a data error', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false }));
  await assert.rejects(fetchElectionResults('25'), /Failed to load data for election 25/);
});
