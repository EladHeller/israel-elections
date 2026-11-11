import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeScenarios, compareScenarios, selectScenarios, voteChangePoints, type AutomaticScenario } from './automatic-scenarios';
import { calcVotesResults } from './calc';
import type { BlocsConfig, ElectionConfig, VoteData } from '../types';

const config: ElectionConfig = { blockPercentage: 0.0325, agreements: [['a', 'b']], algorithm: 'baderOffer' };
const blocs: BlocsConfig = { blocks: {
  right: { label: 'Right', color: 'blue', parties: ['a', 'b'] },
  left: { label: 'Left', color: 'red', parties: ['c'] },
  arab: { label: 'Arab', color: 'green', parties: ['d'], complementaryTo: 'left' },
} };
const data = (counts: number[]): VoteData => Object.fromEntries(counts.map((votes, i) => [String.fromCharCode(97 + i), { votes, mandats: 0 }]));
const signature = (votes: VoteData, c = config) => JSON.stringify(Object.entries(calcVotesResults(votes, c.blockPercentage, c.agreements, c.algorithm).realResults)
  .map(([key, value]) => [key, value.mandats]));

test('boundary search covers every allocation transition in a full integer scan, including threshold crossings and agreement splits', () => {
  let seed = 901;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let iteration = 0; iteration < 30; iteration++) {
    const votes = data(Array.from({ length: 4 }, () => 1 + Math.floor(random() * 800)));
    const c = { ...config, blockPercentage: iteration % 3 === 0 ? 0.15 : 0.0325 };
    for (const party of Object.keys(votes)) {
      const limit = Math.floor(votes[party].votes * 0.2);
      const points = new Set(voteChangePoints(votes, c, party, limit));
      let previous = '';
      for (let delta = -limit; delta <= limit; delta++) {
        const current = signature({ ...votes, [party]: { votes: votes[party].votes + delta, mandats: 0 } }, c);
        if (previous && current !== previous) assert.ok(points.has(delta), `missed ${JSON.stringify({ votes, party, delta, c })}`);
        previous = current;
      }
    }
  }
});

test('every returned vote scenario obeys both distance limits and includes every changed party', () => {
  const voteData = data([4900, 800, 4300, 200]);
  const before = calcVotesResults(voteData, config.blockPercentage, config.agreements, config.algorithm).realResults;
  const result = analyzeScenarios({ voteData, config, blocs });
  assert.ok(result.votes.length);
  assert.deepEqual(result.baseline.seats, Object.fromEntries(Object.entries(before).map(([party, { mandats }]) => [party, mandats])));
  assert.equal(result.baseline.blocs.right, (before.a?.mandats ?? 0) + (before.b?.mandats ?? 0));
  for (const scenario of result.votes) {
    assert.ok(scenario.distance <= 0.01);
    assert.ok(scenario.relativeDistance <= 0.2);
    const party = scenario.party!;
    const next = calcVotesResults({ ...voteData, [party]: { votes: voteData[party].votes + scenario.delta, mandats: 0 } }, config.blockPercentage, config.agreements, config.algorithm).realResults;
    for (const key of Object.keys(voteData)) assert.equal(scenario.seatDeltas[key] || 0, (next[key]?.mandats || 0) - (before[key]?.mandats || 0));
    assert.equal(Object.values(scenario.seatDeltas).reduce((a, b) => a + b, 0), 0);
  }
  assert.ok(selectScenarios(result).length <= 5);
  assert.equal(new Set(result.votes.map(s => JSON.stringify(s.seatDeltas))).size, result.votes.length);
});

test('party view finds nearest gain and loss even when no bloc changes; does not edit other parties', () => {
  const voteData = data([500, 500, 0, 0]);
  const sameBloc: BlocsConfig = { blocks: { all: { label: 'All', color: 'blue', parties: ['a', 'b'] } } };
  const c = { ...config, agreements: [] };
  const analysis = analyzeScenarios({ voteData, config: c, blocs: sameBloc, party: 'a' });
  assert.ok(analysis.votes.some(s => s.goals.includes('party:gain')));
  assert.ok(analysis.votes.some(s => s.goals.includes('party:lose')));
  assert.ok(analysis.votes.every(s => s.party === 'a'));
  for (const goal of ['party:gain', 'party:lose']) {
    const nearest = analysis.votes.find(s => s.goals.includes(goal))!;
    for (let delta = -Math.abs(nearest.delta) + 1; delta < Math.abs(nearest.delta); delta++) {
      const next = calcVotesResults({ ...voteData, a: { votes: 500 + delta, mandats: 0 } }, c.blockPercentage, [], c.algorithm).realResults;
      const baseline = calcVotesResults(voteData, c.blockPercentage, [], c.algorithm).realResults;
      assert.equal(goal === 'party:gain' ? next.a.mandats > baseline.a.mandats : next.a.mandats < baseline.a.mandats, false);
    }
  }
});

test('empty and zero vote data produce no suggestions', () => {
  const empty = { baseline: { seats: {}, blocs: {} }, votes: [], thresholds: [] };
  assert.deepEqual(analyzeScenarios({ voteData: {}, config, blocs }), empty);
  assert.deepEqual(analyzeScenarios({ voteData: data([0, 0]), config, blocs }), empty);
});

test('ranking respects distance bands before majority importance', () => {
  const scenario = (distance: number, goals: string[], delta = 10): AutomaticScenario => ({ party: 'a', distance, goals, delta, relativeDistance: 0.01, seatDeltas: {}, blocDeltas: {} });
  const near = scenario(0.0001, ['transfer:right:left']);
  const farMajority = scenario(0.006, ['majority:right:gain']);
  assert.ok(compareScenarios(near, farMajority) < 0);
  assert.ok(compareScenarios(scenario(0.0008, ['majority:right:gain']), near) < 0);
});

test('threshold suggestions preserve votes and match the simulator resolution', () => {
  const voteData = data([5000, 350, 4500, 150]);
  const analysis = analyzeScenarios({ voteData, config, blocs });
  assert.ok(analysis.thresholds.length);
  assert.ok(analysis.thresholds.some(s => s.threshold === 0));
  for (const scenario of analysis.thresholds) {
    assert.equal(scenario.delta, 0);
    assert.equal(scenario.party, undefined);
    assert.ok(Math.abs(scenario.threshold! * 10000 - Math.round(scenario.threshold! * 10000)) < 1e-8);
  }
});

test('historical largest-remainder elections use an exhaustive bounded search', () => {
  assert.deepEqual(voteChangePoints(data([100, 200]), { ...config, algorithm: 'ceilRound' }, 'a', 2), [-2, -1, 0, 1, 2]);
  const analysis = analyzeScenarios({ voteData: data([501, 499]), config: { ...config, algorithm: 'ceilRound', agreements: [] }, blocs, party: 'a' });
  assert.ok(analysis.votes.length);
});

test('majority loss, unassigned lists, tiny vote counts and the maximum threshold are handled', () => {
  const analysis = analyzeScenarios({ voteData: data([505, 495]), config: { ...config, agreements: [] },
    blocs: { blocks: { right: { label: 'Right', color: 'blue', parties: ['a'] }, left: { label: 'Left', color: 'red', parties: ['b'] } } } });
  assert.ok(analysis.votes.some(s => s.goals.includes('majority:right:lose')));
  const withoutAssignment = analyzeScenarios({ voteData: data([500, 500]), config, blocs, partyToBloc: { a: null, b: undefined } });
  assert.equal(withoutAssignment.votes.length, 0);
  assert.deepEqual(analyzeScenarios({ voteData: data([1]), config, blocs }).votes, []);
  const threshold: AutomaticScenario = { threshold: 0, delta: 0, distance: 0, relativeDistance: 0, goals: [], seatDeltas: {}, blocDeltas: {} };
  assert.equal(compareScenarios(threshold, { ...threshold }), 0);
});
