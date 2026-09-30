import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeBlocMap, computeBlocTotals, computeSeatMargins } from './analytics';
import { calcVotesResults } from './calc';
import type { BlocsConfig, ElectionConfig, VoteData } from '../types';

describe('bloc totals', () => {
  const blocs: BlocsConfig = {
    blocks: {
      first: { label: 'First', color: 'blue', parties: ['a', 'b'] },
      second: { label: 'Second', color: 'red', parties: ['c'] },
      empty: { label: 'Empty', color: 'gray', parties: [] },
    },
  };
  const results = {
    a: { votes: 100, mandats: 40 },
    b: { votes: 100, mandats: 30 },
    c: { votes: 100, mandats: 20 },
    outside: { votes: 100, mandats: 10 },
  };

  it('counts each assigned party, keeps empty blocs and ignores unassigned parties', () => {
    assert.deepEqual(computeBlocMap(blocs), { a: 'first', b: 'first', c: 'second' });
    assert.deepEqual(computeBlocTotals(results, blocs), { first: 70, second: 20, empty: 0 });
    assert.deepEqual(computeBlocTotals({}, blocs), { first: 0, second: 0, empty: 0 });
  });

  it('supports moving and removing parties without counting unknown bloc keys', () => {
    const overrides = { ...computeBlocMap(blocs), a: 'second', b: null, outside: 'unknown' };
    assert.deepEqual(computeBlocTotals(results, blocs, overrides), { first: 0, second: 60, empty: 0 });
    assert.deepEqual(blocs.blocks.first.parties, ['a', 'b']);
  });
});

describe('seat margins', () => {
  const settings: ElectionConfig = { blockPercentage: 0, agreements: [], algorithm: 'baderOffer' };

  it('cannot gain beyond all 120 seats and loses them only after exhausting a sole party votes', () => {
    const data: VoteData = { a: { votes: 1000, mandats: 0 } };
    const results = calcVotesResults(data, 0, [], 'baderOffer').realResults;
    assert.deepEqual(computeSeatMargins(results, data, settings), [
      { party: 'a', mandats: 120, gain: null, lose: 1000 },
    ]);
  });

  it('does not offer a loss for a party that qualifies without receiving a seat', () => {
    const data: VoteData = {
      a: { votes: 100000, mandats: 0 },
      b: { votes: 1, mandats: 0 },
    };
    const results = calcVotesResults(data, 0, [], 'baderOffer').realResults;
    const margin = computeSeatMargins(results, data, settings).find(({ party }) => party === 'b')!;
    assert.equal(margin.mandats, 0);
    assert.equal(margin.lose, null);
    assert.ok(margin.gain !== null && margin.gain > 0);
  });

  it('handles a stale result entry whose party has no vote data', () => {
    assert.deepEqual(computeSeatMargins({ missing: { votes: 0, mandats: 1 } }, {}, settings), [
      { party: 'missing', mandats: 1, gain: null, lose: null },
    ]);
  });
});
