import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calcVotesResults, sumBy } from './calc';
import { computeRemainingSeatRaces, estimateRemainingValidVotes, projectRemainingVotes } from './remaining-votes';
import RemainingVotesPanel from '../components/RemainingVotesPanel';
import type { ElectionConfig, ElectionResultsPayload, VoteData } from '../types';

const votes = (values: Record<string, number>): VoteData => Object.fromEntries(
  Object.entries(values).map(([key, count]) => [key, { votes: count, mandats: 0 }]),
);
const settings: ElectionConfig = { algorithm: 'baderOffer', blockPercentage: 0.0325, agreements: [['a', 'b']] };
const calculate = (data: VoteData, config = settings) => calcVotesResults(data,
  config.blockPercentage, config.agreements, config.algorithm).realResults;
const payload = (valid: number, countedVotes?: number): ElectionResultsPayload => ({
  voteData: votes({ a: valid }), realResults: {}, countedVotes,
});

test('requires late, incomplete counting and a usable estimate, including invalid ballots', () => {
  for (const total of [undefined, 0, -1, NaN, Infinity, 100.5, 800, 850]) {
    assert.equal(estimateRemainingValidVotes(payload(850), total, true), null);
  }
  assert.equal(estimateRemainingValidVotes(payload(849), 1000, true), null);
  assert.equal(estimateRemainingValidVotes(payload(850), 1000, false), null);
  assert.equal(estimateRemainingValidVotes(payload(850), 1000, true), 150);
  assert.equal(estimateRemainingValidVotes(payload(800, 850), 1000, true), 141);
  assert.equal(estimateRemainingValidVotes(payload(0, 900), 1000, true), null);
  assert.equal(estimateRemainingValidVotes(payload(999), 1000, true), 1);
  assert.equal(estimateRemainingValidVotes(payload(1000), 1000, true), null);
});

test('allocates all remaining votes in exact ratios and does not mutate counted data', () => {
  const data = votes({ a: 100, b: 200, c: 400, zero: 0 });
  const original = structuredClone(data);
  const result = projectRemainingVotes(data, 'a', 7, 107);
  assert.equal(result.a.votes, 107);
  assert.equal(result.b.votes, 200 + 100 / 3);
  assert.equal(result.c.votes, 400 + 200 / 3);
  assert.equal(result.zero.votes, 0);
  assert.equal(sumBy(Object.values(result), 'votes'), 807);
  assert.deepEqual(data, original);
  assert.equal(projectRemainingVotes(votes({ a: 100 }), 'a', 10, 10).a.votes, 110);
  assert.equal(projectRemainingVotes(votes({ a: 100, b: 0 }), 'a', 10, 10).b.votes, 0);
});

test('returns no races for invalid budgets or no votes', () => {
  for (const remaining of [0, -1, NaN, Infinity, 1.5]) {
    assert.deepEqual(computeRemainingSeatRaces({}, votes({ a: 50 }), settings, remaining), []);
  }
  assert.deepEqual(computeRemainingSeatRaces({}, {}, settings, 10), []);
});

test('recalculates final seats rather than dividing the existing gain margin by remaining votes', () => {
  const data = votes({ a: 40000, b: 20000, c: 20000, d: 16690, e: 3310, zero: 0 });
  for (const algorithm of ['baderOffer', 'ceilRound'] as const) {
    const config = { ...settings, algorithm };
    const current = calculate(data, config);
    const races = computeRemainingSeatRaces(current, data, config, 15000);
    assert.equal(races.length, 5);
    for (const race of races) {
      assert.equal(race.currentShare, data[race.party].votes / 100000);
      assert.ok(race.requiredVotes !== null);
      const required = race.requiredVotes!;
      assert.equal(race.requiredShare, required / 15000);
      const seatsAt = (count: number) => calculate(projectRemainingVotes(data, race.party, count, 15000), config)[race.party]?.mandats ?? 0;
      assert.ok(seatsAt(required) > (current[race.party]?.mandats ?? 0));
      if (required > 0) assert.ok(seatsAt(required - 1) <= (current[race.party]?.mandats ?? 0));
    }
    const ratios = races.map(race => race.requiredShare! / race.currentShare);
    assert.deepEqual(ratios, [...ratios].sort((a, b) => a - b));
  }
});

test('ranks relative gains ahead of smaller absolute required shares', () => {
  const data = votes({ a: 40000, b: 20000, c: 20000, d: 16690, e: 3310, zero: 0 });
  const races = computeRemainingSeatRaces(calculate(data), data, settings, 15000);
  assert.deepEqual(races.map(race => race.party), ['a', 'b', 'c', 'd', 'e']);
  assert.ok(races[0].requiredShare! > races[4].requiredShare!);
  assert.ok(races[0].requiredShare! / races[0].currentShare
    < races[4].requiredShare! / races[4].currentShare);
});

test('handles insufficient remaining votes, crossing threshold and an already complete majority', () => {
  const data = votes({ a: 97000, b: 3000 });
  const current = calculate(data);
  const impossible = computeRemainingSeatRaces(current, data, settings, 10);
  assert.ok(impossible.every(race => race.requiredVotes === null && race.requiredShare === null));
  const ordered = computeRemainingSeatRaces(current, data, settings, 1000);
  assert.deepEqual(ordered.map(race => race.party), ['b', 'a']);
  assert.equal(ordered.at(-1)!.requiredShare, null);
  const race = ordered[0];
  assert.equal(race.requiredVotes, 283);
  assert.ok(calculate(projectRemainingVotes(data, 'b', race.requiredVotes!, 1000)).b.mandats > 0);
  const single = votes({ a: 10000 });
  assert.equal(computeRemainingSeatRaces(calculate(single), single, settings, 1000)[0].requiredVotes, null);
});

test('matches exhaustive small-budget search with agreements and threshold crossings', () => {
  for (let seed = 1; seed <= 15; seed++) {
    const data = votes({ a: 400 + seed * 3, b: 200 - seed, c: 30 + seed, d: 220 });
    const current = calculate(data);
    for (const race of computeRemainingSeatRaces(current, data, settings, 40)) {
      let expected: number | null = null;
      for (let count = 0; count <= 40; count++) {
        const next = calculate(projectRemainingVotes(data, race.party, count, 40));
        if ((next[race.party]?.mandats ?? 0) > (current[race.party]?.mandats ?? 0)) { expected = count; break; }
      }
      assert.equal(race.requiredVotes, expected, `seed ${seed}, party ${race.party}`);
    }
  }
});

test('finds the first gain even when largest-remainder rounding later takes the seat away', () => {
  const data = votes({ a: 270, b: 553, c: 584, d: 155, e: 498 });
  const config: ElectionConfig = { algorithm: 'ceilRound', agreements: [['a', 'b'], ['c', 'd']], blockPercentage: 0.0325 };
  const races = computeRemainingSeatRaces(calculate(data, config), data, config, 57);
  assert.equal(races.find(race => race.party === 'e')!.requiredVotes, 15);
  assert.equal(races.find(race => race.party === 'a')!.requiredVotes, 18);
  const single = votes({ a: 10000 });
  assert.equal(computeRemainingSeatRaces(calculate(single, config), single, config, 100)[0].requiredVotes, null);
  const thresholdData = votes({ a: 9700, b: 300 });
  const crossing = computeRemainingSeatRaces(calculate(thresholdData, config), thresholdData, config, 1000);
  assert.ok(crossing.find(race => race.party === 'b')!.requiredVotes !== null);
  const excluded = { ...config, blockPercentage: 1, agreements: [] };
  assert.ok(computeRemainingSeatRaces({}, thresholdData, excluded, 100)
    .every(race => race.requiredVotes === null));
});

test('renders three figures, a short assumption and an explicit impossible state', () => {
  const races = [{ party: 'a', currentShare: 0.07, requiredShare: 0.09, requiredVotes: 900 },
    { party: 'b', currentShare: 0.03, requiredShare: null, requiredVotes: null }];
  const props = { races, remainingVotes: 10000, getPartyName: (party: string) => party };
  const html = renderToStaticMarkup(React.createElement(RemainingVotesPanel, props));
  assert.match(html, /7%/); assert.match(html, /9%/); assert.match(html, /900/);
  assert.match(html, /היחס בין שאר הרשימות נשמר/);
  assert.match(html, /אין די קולות שנותרו/);
  assert.doesNotMatch(html, /<button/);
});
