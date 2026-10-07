import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCalcSteps } from './calcSteps';
import { calcVotesResults } from './calc';
import type { VoteData } from '../types';

describe('calculation details with custom thresholds', () => {
  const data: VoteData = {
    a: { votes: 600, mandats: 0 },
    b: { votes: 400, mandats: 0 },
  };

  for (const algorithm of ['baderOffer', 'ceilRound'] as const) {
    it(`explains remainder awards and an agreement split using ${algorithm}`, () => {
      const voteData: VoteData = {
        a: { votes: 360, mandats: 0 },
        b: { votes: 640, mandats: 0 },
        c: { votes: 1000, mandats: 0 },
      };
      const before = structuredClone(voteData);
      const agreements: [string, string][] = [['a', 'b']];
      const steps = buildCalcSteps(voteData, { blockPercentage: 0.01, algorithm, agreements });
      const expected = algorithm === 'baderOffer' ? { a: 21, b: 39, c: 60 } : { a: 21, b: 38, c: 61 };
      assert.equal(steps.totalWhole, 119);
      assert.equal(steps.remainingMandats, 1);
      assert.ok(steps.remainderRounds.length > 0);
      assert.deepEqual(Object.fromEntries(steps.finalResults.map(({ party, total }) => [party, total])), expected);
      const split = steps.agreementSplits[0];
      assert.equal(split.aResult.mandats, expected.a);
      assert.equal(split.bResult.mandats, expected.b);
      assert.equal(split.aWholeMandats + split.bWholeMandats + split.remainingAfterWhole, split.totalMandats);
      assert.equal(split.remainingAfterWhole, 1);
      assert.ok(split.splitRounds.length > 0);
      assert.deepEqual(voteData, before);
    });

    it(`reports agreements where one or both parties are ineligible using ${algorithm}`, () => {
      const steps = buildCalcSteps(data, { blockPercentage: 0.5, algorithm,
        agreements: [['a', 'b'], ['b', 'a'], ['b', 'missing']] });
      assert.deepEqual(steps.agreementsInfo.map(({ valid, invalidParties }) => ({ valid, invalidParties })), [
        { valid: false, invalidParties: ['b'] },
        { valid: false, invalidParties: ['b'] },
        { valid: false, invalidParties: ['b', 'missing'] },
      ]);
      assert.deepEqual(steps.agreementSplits, []);
      assert.deepEqual(steps.finalResults.map(({ party, total }) => [party, total]), [['a', 120]]);
    });

    it(`handles an agreement between two qualifying parties with zero seats using ${algorithm}`, () => {
      const voteData: VoteData = { a: { votes: 1, mandats: 0 }, b: { votes: 1, mandats: 0 },
        c: { votes: 100000, mandats: 0 } };
      const steps = buildCalcSteps(voteData, { blockPercentage: 0, algorithm, agreements: [['a', 'b']] });
      assert.equal(steps.aboveBlock.length, 3);
      assert.deepEqual(steps.agreementSplits, []);
      assert.deepEqual(steps.finalResults.map(({ party, total }) => [party, total]), [['c', 120]]);
    });

    it(`handles no qualifying parties and no votes using ${algorithm}`, () => {
      for (const voteData of [data, {}]) {
        const steps = buildCalcSteps(voteData, { blockPercentage: 0.8, algorithm,
          agreements: [['a', 'b']] });
        assert.equal(steps.participatingVotes, 0);
        assert.equal(steps.votesPerMandat, 0);
        assert.equal(steps.remainingMandats, 0);
        assert.equal(steps.totalMandats, 0);
        assert.deepEqual(steps.remainderRounds, []);
        assert.deepEqual(steps.finalResults, []);
        assert.deepEqual(steps.agreementSplits, []);
      }
    });

    it(`keeps calculation details consistent with results using ${algorithm}`, () => {
      const agreements: [string, string][] = [['a', 'b']];
      const steps = buildCalcSteps(data, { blockPercentage: 0.01, algorithm, agreements });
      const results = calcVotesResults(data, 0.01, agreements, algorithm).realResults;
      assert.equal(steps.totalMandats, 120);
      assert.equal(steps.finalResults.reduce((sum, row) => sum + row.total, 0), 120);
      for (const row of steps.finalResults) assert.equal(row.total, results[row.party].mandats);
    });
  }

  it('uses no surplus agreements when none are supplied', () => {
    const steps = buildCalcSteps(data, { blockPercentage: 0.01, algorithm: 'baderOffer' });
    assert.deepEqual(steps.agreementsInfo, []);
    assert.deepEqual(steps.agreementSplits, []);
    assert.equal(steps.totalMandats, 120);
  });

  it('does not invent an allocation for a second agreement reusing the same party', () => {
    const voteData: VoteData = { a: { votes: 400, mandats: 0 }, b: { votes: 300, mandats: 0 },
      c: { votes: 200, mandats: 0 } };
    const steps = buildCalcSteps(voteData, { blockPercentage: 0.01, algorithm: 'baderOffer',
      agreements: [['a', 'b'], ['a', 'c']] });
    assert.equal(steps.agreementSplits.length, 1);
    assert.deepEqual(steps.agreementSplits[0].parties, ['a', 'b']);
    assert.equal(steps.finalResults.reduce((sum, { total }) => sum + total, 0), 120);
  });

  it('keeps agreement whole seats and remainder awards within the allocated seats', () => {
    for (const algorithm of ['baderOffer', 'ceilRound'] as const) {
      for (const [a, b, c] of [[1, 1, 100000], [100, 101, 10000], [99, 190, 9971],
        [1000000001, 2000000001, 10000000000], [1, 1000000000, 50]]) {
        const voteData: VoteData = { a: { votes: a, mandats: 0 }, b: { votes: b, mandats: 0 },
          c: { votes: c, mandats: 0 } };
        const steps = buildCalcSteps(voteData, { blockPercentage: 0, algorithm, agreements: [['a', 'b']] });
        assert.equal(steps.finalResults.reduce((sum, { total }) => sum + total, 0), 120);
        for (const split of steps.agreementSplits) {
          assert.ok(split.aWholeMandats >= 0 && split.bWholeMandats >= 0);
          assert.ok(split.aWholeMandats + split.bWholeMandats <= split.totalMandats);
          assert.equal(split.aWholeMandats + split.bWholeMandats + split.remainingAfterWhole, split.totalMandats);
          assert.equal(split.aResult.mandats + split.bResult.mandats, split.totalMandats);
        }
      }
    }
  });
});
