import assert from 'node:assert/strict';
import { test } from 'node:test';
import { excludeWithdrawnLists } from './withdrawn-lists';
import manifests from '../data/elections-manifests.json';
import initialResults from '../../public/data/26/allResults.json';
import { getCountingParties } from './counting-parties';
import type { ElectionManifest, ElectionResultsPayload } from '../types';

test('explicitly withdrawn columns stay hidden without changing the original snapshot', () => {
  const votes = { 'מחל': { votes: 100, mandats: 120 }, 'צבי': { votes: 0, mandats: 0 }, 'כן': { votes: 0, mandats: 0 } };
  const results = { voteData: votes, realResults: votes, withoutAgreements: votes,
    beforeBaderOffer: votes, afterBaderOffer: votes, countedVotes: 105, time: 'source-time' };
  const filtered = excludeWithdrawnLists(results, ['צבי', 'כן']);
  for (const field of ['voteData', 'realResults', 'withoutAgreements', 'beforeBaderOffer', 'afterBaderOffer'] as const) {
    assert.deepEqual(Object.keys(filtered[field]!), ['מחל']);
    assert.equal(Object.keys(results[field]).length, 3);
  }
  assert.equal(filtered.countedVotes, 105);
  assert.equal(filtered.time, 'source-time');
});

test('historical elections are unchanged and optional result maps stay absent', () => {
  const results: ElectionResultsPayload = { voteData: {}, realResults: {} };
  assert.equal(excludeWithdrawnLists(results), results);
  assert.deepEqual(excludeWithdrawnLists(results, ['כן']), results);
});

test('the initial snapshot and all 38 registered lists include Blue and White and Ahi', () => {
  assert.equal(manifests['26'].lists.length, 38);
  assert.ok(manifests['26'].lists.some(list => list.ballotLetter === 'כן' && list.name === 'כחול לבן'));
  assert.ok(manifests['26'].lists.some(list => list.ballotLetter === 'צבי' && list.name === 'אחי'));
  for (const field of ['voteData', 'realResults', 'withoutAgreements', 'beforeBaderOffer'] as const) {
    assert.deepEqual(Object.keys(initialResults[field]).sort(), manifests['26'].lists.map(list => list.ballotLetter).sort());
  }
});

test('Knesset 26 preserves both lists and their votes in fetched snapshots and the client list', () => {
  const manifest = manifests['26'] as ElectionManifest;
  const votes = { 'צבי': { votes: 17, mandats: 0 }, 'כן': { votes: 23, mandats: 0 } };
  const results = { voteData: votes, realResults: votes, withoutAgreements: votes, beforeBaderOffer: votes, afterBaderOffer: votes };
  assert.equal(excludeWithdrawnLists(results, manifest.withdrawnLists), results);
  const parties = getCountingParties(results.voteData, results.realResults, manifest.lists);
  assert.equal(parties.length, 38);
  assert.equal(parties.find(({ party }) => party === 'צבי')?.votes, 17);
  assert.equal(parties.find(({ party }) => party === 'כן')?.votes, 23);
});
