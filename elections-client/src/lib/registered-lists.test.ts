import assert from 'node:assert/strict';
import { test } from 'node:test';
import manifests from '../data/elections-manifests.json';
import initialResults from '../../public/data/26/allResults.json';
import { getCountingParties } from './counting-parties';

test('the initial snapshot and all 38 registered lists include Blue and White and Ahi', () => {
  assert.equal(manifests['26'].lists.length, 38);
  assert.ok(manifests['26'].lists.some(list => list.ballotLetter === 'כן' && list.name === 'כחול לבן'));
  assert.ok(manifests['26'].lists.some(list => list.ballotLetter === 'צבי' && list.name === 'אחי'));
  for (const field of ['voteData', 'realResults', 'withoutAgreements', 'beforeBaderOffer'] as const) {
    assert.deepEqual(Object.keys(initialResults[field]).sort(), manifests['26'].lists.map(list => list.ballotLetter).sort());
  }
});

test('Knesset 26 preserves both lists and their votes in fetched snapshots and the client list', () => {
  const manifest = manifests['26'];
  const votes = { 'צבי': { votes: 17, mandats: 0 }, 'כן': { votes: 23, mandats: 0 } };
  const results = { voteData: votes, realResults: votes, withoutAgreements: votes, beforeBaderOffer: votes, afterBaderOffer: votes };
  const parties = getCountingParties(results.voteData, results.realResults, manifest.lists);
  assert.equal(parties.length, 38);
  assert.equal(parties.find(({ party }) => party === 'צבי')?.votes, 17);
  assert.equal(parties.find(({ party }) => party === 'כן')?.votes, 23);
});
