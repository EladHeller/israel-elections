import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeQuestionWithData, type QuestionDataLoader } from './question-execution';
import namesAll from '../data/party-names.json';
import { executeElectionQuestion, type QuestionContext, type QuestionQuery } from './election-questions';

const context: QuestionContext = { electionId: '26', names: { a: 'הליכוד', b: 'רשימה ב' }, votes: { a: { votes: 600, mandats: 0 }, b: { votes: 400, mandats: 0 } }, config: { blockPercentage: 0.0325, algorithm: 'baderOffer', agreements: [] } };
const csv = 'סמל ישוב,שם ישוב,מספר קלפי,כשרים,a,b\n3000,ירושלים,1,1000,600,400\n';
const calls: string[] = [];
const loader: QuestionDataLoader = {
  text: async path => { calls.push(path); return csv; },
  comparison: async id => ({ id, votes: context.votes, names: context.names, config: context.config }),
};

test('shared execution matches the engine for national questions without loading geography', async () => {
  calls.length = 0;
  const query: QuestionQuery = { kind: 'results', parties: ['a'] };
  assert.deepEqual(await executeQuestionWithData(query, context, loader), executeElectionQuestion(query, context));
  assert.deepEqual(calls, []);
});

test('loads only the requested geographic source, including embedded historical stations', async () => {
  for (const [id, level, path] of [['26', 'localities', '/data/26/elections.csv'], ['26', 'stations', '/data/26/polling-stations.csv'], ['19', 'stations', '/data/19/elections.csv']] as const) {
    calls.length = 0;
    await executeQuestionWithData({ kind: 'rank', party: 'a', level, order: 'votes', limit: 1 }, { ...context, electionId: id }, loader);
    assert.deepEqual(calls, [path]);
  }
  for (const level of ['localities', 'stations'] as const) {
    await assert.rejects(executeQuestionWithData({ kind: 'rank', party: 'a', level, order: 'votes', limit: 1 }, { ...context, electionId: '1' }, loader), /אין נתוני מקומות/);
  }
  await assert.rejects(executeQuestionWithData({ kind: 'rank', party: 'a', level: 'localities', order: 'votes', limit: 1 }, context, { ...loader, text: async () => { throw new Error('offline'); } }), /offline/);
});

test('loads comparison snapshots and previous-election geography through injected adapters', async () => {
  const comparison: QuestionQuery = { kind: 'comparison', source: '25', target: { type: 'list', id: 'a' }, measure: 'votes' } as QuestionQuery;
  let loaded = '';
  await executeQuestionWithData(comparison, context, { ...loader, comparison: async id => { loaded = id; return loader.comparison(id); } });
  assert.equal(loaded, '25');
  for (const metric of ['strengthened', 'weakened'] as const) {
    const query = { kind: 'insight', metric, party: 'a', level: 'localities', limit: 1, minimum: 0 } as QuestionQuery;
    calls.length = 0;
    await executeQuestionWithData(query, context, loader);
    assert.deepEqual(calls, ['/data/26/elections.csv', '/data/25/elections.csv']);
    await assert.rejects(executeQuestionWithData(query, { ...context, electionId: '15' }, loader), /אין נתוני יישובים/);
  }
});

test('missing previous list names fail without inventing a historical match', async () => {
  const entries = namesAll as Record<string, Record<string, string>>;
  const previous = entries['25'];
  delete entries['25'];
  try {
    await assert.rejects(executeQuestionWithData({ kind: 'insight', metric: 'strengthened', party: 'a', level: 'localities', limit: 1, minimum: 0, byVotes: false }, context, loader));
  } finally { entries['25'] = previous; }
});
