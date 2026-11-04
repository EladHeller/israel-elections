import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeElectionQuestion, type QuestionContext, type QuestionQuery } from './election-questions';
import { questionScenarioHref } from './question-scenario';
import { decodeSharedScenario } from './shared-scenario';
import { computeScenarioResults } from './scenario';

const context: QuestionContext = {
  electionId: '26', names: { a: 'רשימה א', b: 'רשימה ב' },
  votes: { a: { votes: 500, mandats: 0 }, b: { votes: 310, mandats: 0 }, c: { votes: 190, mandats: 0 } },
  config: { algorithm: 'baderOffer', blockPercentage: 0.2, agreements: [['a', 'b']] },
};

test('question links round trip the exact scenario and baseline across supported scenario kinds', async () => {
  const queries: QuestionQuery[] = [
    { kind: 'seat-gap', party: 'a' }, { kind: 'seat-loss', party: 'a' },
    { kind: 'scenario', threshold: 0 }, { kind: 'scenario', withoutAgreements: true },
    { kind: 'scenario', transfer: { from: 'a', to: 'b', fraction: 0.2 } },
    { kind: 'gap', party: 'c', denominator: 'additional' },
    { kind: 'insight', metric: 'threshold-entry', byVotes: false, party: 'c', minimum: 0, limit: 10, level: 'localities' },
    { kind: 'comparison-scenario', target: { type: 'list', id: 'a' }, mode: 'zero' },
  ];
  for (const algorithm of ['baderOffer', 'ceilRound'] as const) {
    const source = { ...context, config: { ...context.config, algorithm } };
    const original = structuredClone(source);
    for (const query of queries) {
      const answer = executeElectionQuestion(query, source);
      const href = await questionScenarioHref(answer, source, '26');
      assert.ok(href);
      assert.ok(href.startsWith('/simulator/26#scenario='), JSON.stringify(query));
      const shared = await decodeSharedScenario(href.split('=')[1], '26');
      assert.equal(shared.demo, false);
      assert.deepEqual(shared.base.config, source.config);
      for (const party of Object.keys(source.votes)) {
        assert.equal(shared.base.voteData[party].votes, source.votes[party].votes);
        assert.equal(shared.scenario.voteData[party].votes, answer.scenario!.voteData[party].votes);
        assert.equal(shared.scenario.voteData[party].name, source.names[party] ?? party);
      }
      assert.deepEqual(shared.scenario.config, answer.scenario!.config);
      const calculated = computeScenarioResults(shared.scenario.voteData, shared.scenario.config).realResults;
      for (const change of answer.seatChanges ?? []) assert.equal(calculated[change.party]?.mandats ?? 0, change.after);
      if (query.kind === 'seat-gap' || query.kind === 'seat-loss') {
        const delta = Number(answer.rows[0][1]) * (query.kind === 'seat-loss' ? -1 : 1);
        assert.equal(shared.scenario.voteData.a.votes, source.votes.a.votes + delta);
      }
      if (query.kind === 'scenario') for (const row of answer.rows) {
        const party = Object.keys(source.votes).find(id => (source.names[id] ?? id) === row[0])!;
        assert.equal(calculated[party]?.mandats ?? 0, row[2]);
      }
    }
    assert.deepEqual(source, original);
  }
});

test('questions without a concrete scenario have no simulator link', async () => {
  for (const query of [
    { kind: 'results', parties: ['a'] }, { kind: 'gap', party: 'c', denominator: 'fixed' },
    { kind: 'gap', party: 'a', denominator: 'additional' },
    { kind: 'seat-loss', party: 'c' },
  ] as QuestionQuery[]) {
    const answer = executeElectionQuestion(query, context);
    assert.equal(await questionScenarioHref(answer, context, '26'), undefined);
  }
  const only = { ...context, votes: { a: { votes: 100, mandats: 0 } }, config: { ...context.config, agreements: [] } };
  assert.equal(await questionScenarioHref(executeElectionQuestion({ kind: 'seat-gap', party: 'a' }, only), only, '26'), undefined);
});
