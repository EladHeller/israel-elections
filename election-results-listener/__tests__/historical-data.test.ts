import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const dataDirectory = new URL('../../elections-client/public/data/', import.meta.url);

test('published election results do not include committee metadata as a party', () => {
  for (const election of readdirSync(dataDirectory)) {
    const results = JSON.parse(readFileSync(new URL(`${election}/allResults.json`, dataDirectory), 'utf8'));
    for (const section of ['voteData', 'realResults', 'withoutAgreements', 'beforeBaderOffer']) {
      assert.ok(!Object.keys(results[section] ?? {}).some(key => key.trim() === 'סמל ועדה'),
        `Election ${election}: committee metadata in ${section}`);
    }
  }
});

test('corrected historical votes exclude committee codes and preserve unrepresented votes', () => {
  for (const [election, validVotes, unrepresentedVotes] of [
    [22, 4436806, 126704],
    [23, 4590062, 36901],
    [24, 4410052, 64752],
  ]) {
    const results = JSON.parse(readFileSync(new URL(`${election}/allResults.json`, dataDirectory), 'utf8'));
    const parties = Object.entries(results.voteData) as [string, { votes: number }][];
    assert.equal(parties.reduce((sum, [, { votes }]) => sum + votes, 0), validVotes);
    assert.equal(parties.filter(([key]) => !results.realResults[key]?.mandats)
      .reduce((sum, [, { votes }]) => sum + votes, 0), unrepresentedVotes);
  }
});
