import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calcVotesResults } from './calc';
import { computeProximity, isCloseSeatMargin } from './proximity';
import type { ElectionConfig, VoteData } from '../types';

const votes = (values: Record<string, number>): VoteData => Object.fromEntries(
  Object.entries(values).map(([party, count]) => [party, { votes: count, mandats: 0 }]),
);

const config = (blockPercentage: number, algorithm: ElectionConfig['algorithm'] = 'baderOffer',
  agreements: [string, string][] = []): ElectionConfig => ({ blockPercentage, algorithm, agreements });

const proximity = (data: VoteData, settings: ElectionConfig) => computeProximity(
  calcVotesResults(data, settings.blockPercentage, settings.agreements, settings.algorithm).realResults,
  data,
  settings,
);

describe('threshold proximity', () => {
  for (const threshold of [0.01, 0.015, 0.02, 0.0325]) {
    it(`includes both 0.25-point boundaries at a ${threshold * 100}% threshold`, () => {
      const atThreshold = Math.round(threshold * 100000);
      const data = votes({ below: atThreshold - 250, exact: atThreshold,
        above: atThreshold + 250, outside: atThreshold + 251,
        other: 100000 - 4 * atThreshold - 251 });
      const result = proximity(data, config(threshold));
      assert.deepEqual(new Set(result.thresholdRaces.map(({ party }) => party)),
        new Set(['below', 'exact', 'above']));
      assert.equal(result.thresholdRaces[0].party, 'exact');
      assert.equal(result.thresholdRaces[0].gapVotes, 0);
      assert.equal(result.thresholdRaces.find(({ party }) => party === 'below')?.gapVotes, -250);
      assert.equal(result.thresholdRaces.find(({ party }) => party === 'above')?.gapVotes, 250);
      assert.equal(result.thresholdRaces.find(({ party }) => party === 'above')?.veryClose, false);
    });
  }

  it('marks the inclusive 0.10-point boundary as very close', () => {
    const result = proximity(votes({ a: 1900, b: 2100, c: 2101, rest: 93899 }), config(0.02));
    assert.equal(result.thresholdRaces.find(({ party }) => party === 'a')?.veryClose, true);
    assert.equal(result.thresholdRaces.find(({ party }) => party === 'b')?.veryClose, true);
    assert.equal(result.thresholdRaces.find(({ party }) => party === 'c')?.veryClose, false);
  });

  it('updates qualifying votes and proximity when the simulator threshold changes', () => {
    const data = votes({ a: 97000, b: 3000 });
    const lower = proximity(data, config(0.03));
    const higher = proximity(data, config(0.04));
    assert.equal(lower.votesPerMandate, 100000 / 120);
    assert.equal(higher.votesPerMandate, 97000 / 120);
    assert.deepEqual(lower.thresholdRaces.map(({ party }) => party), ['b']);
    assert.deepEqual(higher.thresholdRaces, []);
  });

  it('uses the rounded current threshold for vote gaps, without calling it added votes', () => {
    const result = proximity(votes({ a: 33, rest: 968 }), config(0.0325));
    assert.equal(result.thresholdRaces[0].gapVotes, 0);
    assert.ok(result.thresholdRaces[0].gapPercentagePoints > 0);
  });

  it('handles no votes, zero threshold, very low thresholds and 100% thresholds', () => {
    assert.deepEqual(proximity({}, config(0.0325)).thresholdRaces, []);
    const data = votes({ a: 99900, b: 100, zero: 0 });
    assert.deepEqual(proximity(data, config(0)).thresholdRaces, []);
    assert.deepEqual(proximity(data, config(0.001)).thresholdRaces.map(({ party }) => party), ['b']);
    const high = proximity(data, config(1));
    assert.deepEqual(high.thresholdRaces.map(({ party }) => party), ['a']);
    assert.equal(high.seatLimit, 0);
    assert.deepEqual(high.seatRaces, []);
  });
});

describe('mandate proximity', () => {
  it('ranks qualifying parties with no seats and no possible loss', () => {
    for (const data of [votes({ a: 100000, b: 1, c: 1 }), votes({ b: 1, c: 1, a: 100000 })]) {
      const result = proximity(data, config(0));
      const zeroSeatRaces = result.seatRaces.filter(({ mandats }) => mandats === 0);
      assert.equal(zeroSeatRaces.length, 2);
      for (const race of zeroSeatRaces) {
        assert.equal(race.lose, null);
        assert.equal(race.loseCrossesThreshold, false);
        assert.ok(race.gain !== null && race.gain > result.seatLimit);
      }
    }
  });

  it('highlights only positive margins within the inclusive 10% limit', () => {
    assert.equal(isCloseSeatMargin(10, 10), true);
    assert.equal(isCloseSeatMargin(11, 10), false);
    assert.equal(isCloseSeatMargin(0, 10), false);
    assert.equal(isCloseSeatMargin(null, 10), false);
  });

  it('uses unrounded qualifying votes, ignoring parties below the selected threshold', () => {
    const data = votes({ a: 999, b: 1 });
    const result = proximity(data, config(0.02));
    assert.equal(result.votesPerMandate, 999 / 120);
    assert.equal(result.seatLimit, 0);
    assert.deepEqual(result.closeSeatRaces, []);
  });

  for (const algorithm of ['baderOffer', 'ceilRound'] as const) {
    it(`finds actual gain and loss boundaries with agreements using ${algorithm}`, () => {
      const data = votes({ a: 40000, b: 20000, c: 20000, d: 16690, e: 3310 });
      const settings = config(0.02, algorithm, [['a', 'b'], ['c', 'd']]);
      const result = proximity(data, settings);
      assert.equal(result.seatLimit, 83);
      for (const race of result.seatRaces) {
        for (const direction of ['gain', 'lose'] as const) {
          const margin = race[direction];
          if (margin === null) continue;
          const seatsAt = (delta: number) => {
            const changed = { ...data, [race.party]: { ...data[race.party],
              votes: data[race.party].votes + (direction === 'gain' ? delta : -delta) } };
            return calcVotesResults(changed, settings.blockPercentage, settings.agreements,
              settings.algorithm).realResults[race.party]?.mandats ?? 0;
          };
          assert.equal(seatsAt(margin - 1), race.mandats);
          assert.ok(direction === 'gain' ? seatsAt(margin) > race.mandats : seatsAt(margin) < race.mandats);
        }
      }
      const distances = result.seatRaces.map(({ gain, lose }) => Math.min(gain ?? Infinity, lose ?? Infinity));
      assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
      assert.deepEqual(result.closeSeatRaces, result.seatRaces.filter(({ gain, lose }) =>
        (gain !== null && gain <= 83) || (lose !== null && lose <= 83)));
    });
  }

  it('distinguishes dropping below the active threshold from losing one seat', () => {
    const result = proximity(votes({ a: 96750, b: 3250 }), config(0.0325));
    const race = result.seatRaces.find(({ party }) => party === 'b')!;
    assert.equal(race.lose, 1);
    assert.equal(race.loseCrossesThreshold, true);
    assert.ok(race.mandats > 1);
    assert.ok(result.closeSeatRaces.some(({ party }) => party === 'b'));
  });

  it('is empty when the selected threshold excludes every party', () => {
    for (const algorithm of ['baderOffer', 'ceilRound'] as const) {
      const result = proximity(votes({ a: 600, b: 400 }), config(0.8, algorithm));
      assert.equal(result.votesPerMandate, 0);
      assert.deepEqual(result.closeSeatRaces, []);
    }
  });
});
