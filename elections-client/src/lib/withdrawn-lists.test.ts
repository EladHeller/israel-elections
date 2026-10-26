import assert from 'node:assert/strict';
import { test } from 'node:test';
import { excludeWithdrawnLists } from './withdrawn-lists';
import manifests from '../data/elections-manifests.json';
import initialResults from '../../public/data/26/allResults.json';
import { getCountingParties } from './counting-parties';
import type { ElectionResultsPayload } from '../types';

test('withdrawn columns stay hidden in old and newly fetched counting snapshots', () => {
  const votes = { 'מחל': { votes: 100, mandats: 120 }, 'צבי': { votes: 0, mandats: 0 }, 'כן': { votes: 0, mandats: 0 } };
  const results = { voteData: votes, realResults: votes, withoutAgreements: votes,
    beforeBaderOffer: votes, afterBaderOffer: votes, countedVotes: 105, time: 'source-time' };
  const filtered = excludeWithdrawnLists(results, manifests['26'].withdrawnLists);
  for (const field of ['voteData', 'realResults', 'withoutAgreements', 'beforeBaderOffer', 'afterBaderOffer'] as const) {
    assert.deepEqual(Object.keys(filtered[field]!), ['מחל']);
    assert.equal(Object.keys(results[field]).length, 3);
  }
  assert.equal(filtered.countedVotes, 105);
  assert.equal(filtered.time, 'source-time');
  const parties = getCountingParties(filtered.voteData, filtered.realResults, manifests['26'].lists);
  assert.equal(parties.length, 36);
  assert.ok(parties.every(({ party }) => !['צבי', 'כן'].includes(party)));
});

test('historical elections are unchanged and optional result maps stay absent', () => {
  const results: ElectionResultsPayload = { voteData: {}, realResults: {} };
  assert.equal(excludeWithdrawnLists(results), results);
  assert.deepEqual(excludeWithdrawnLists(results, ['כן']), results);
});

test('the initial election snapshot and registered lists omit the two withdrawals', () => {
  assert.equal(manifests['26'].lists.length, 36);
  assert.deepEqual(Object.keys(initialResults.voteData).sort(), manifests['26'].lists.map(list => list.ballotLetter).sort());
});
