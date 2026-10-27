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

test('results exclude ballot metadata from every results map and counted totals', async (t) => {
  const lists = { מחל: { votes: 10, mandats: 120 }, אמת: { votes: 2, mandats: 0 } };
  for (const votes of [0, 100]) {
    const withMetadata = { ...lists, חיצוניות: { votes, mandats: 0 }, 'קלפי אחרת': { votes, mandats: 0 } };
    const payload = {
      voteData: withMetadata, realResults: withMetadata, withoutAgreements: withMetadata,
      beforeBaderOffer: withMetadata, afterBaderOffer: withMetadata,
      countedVotes: 15 + 2 * votes, time: '2026-10-27T23:00:00Z',
    };
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => payload }));
    assert.deepEqual(await fetchElectionResults('26'), {
      voteData: lists, realResults: lists, withoutAgreements: lists,
      beforeBaderOffer: lists, afterBaderOffer: lists,
      countedVotes: 15, time: payload.time,
    });
    assert.ok('חיצוניות' in withMetadata);
  }
});

test('metadata filtering supports results without optional maps or counted totals', async (t) => {
  const payload = { voteData: { מחל: { votes: 10, mandats: 120 }, חיצוניות: { votes: 0, mandats: 0 } } };
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => payload }));
  assert.deepEqual(await fetchElectionResults('26'), { voteData: { מחל: { votes: 10, mandats: 120 } } });
});
