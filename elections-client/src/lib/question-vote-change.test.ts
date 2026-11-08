import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseElectionQuestion, executeElectionQuestion, type QuestionContext, type QuestionQuery } from './election-questions';
import { questionScenarioHref } from './question-scenario';
import { decodeSharedScenario } from './shared-scenario';
import { createQuestionCompletions } from './question-completions';
import { buildQuestionExamples } from './question-examples';

const context: QuestionContext = { electionId: '26', names: { א: 'הליכוד', ב: 'רשימה ב' },
  votes: { א: { votes: 10000, mandats: 0 }, ב: { votes: 20000, mandats: 0 } },
  config: { algorithm: 'baderOffer', blockPercentage: .0325, agreements: [] } };
const query = (question: string) => {
  const parsed = parseElectionQuestion(question, context);
  assert.ok(!('error' in parsed), question);
  return parsed.query;
};

test('relative vote counts accept Hebrew word order, prefixes and validated thousands separators', () => {
  for (const text of [
    'מה היה קורה אם הליכוד הייתה מקבלת 5,000 פחות קולות?',
    'מה יקרה אם מפלגת הליכוד תקבל 5000 קולות פחות',
    'מה אם רשימת הליכוד מקבלת ב־5,000 פחות קולות',
    'מה היה קורה אילו הליכוד היה מקבל ב-5000 קולות פחות',
    'מה אם א יקבל 5000 פחות קולות',
  ]) assert.deepEqual(query(text), { kind: 'scenario', voteChange: { party: 'א', delta: -5000 } });
  assert.deepEqual(query('מה יקרה אם הליכוד תקבל 5,000 יותר קולות'), { kind: 'scenario', voteChange: { party: 'א', delta: 5000 } });
  for (const text of ['מה אם הליכוד תקבל 5,00 פחות קולות', 'מה אם הליכוד תקבל 1.5 פחות קולות',
    'מה אם הליכוד תקבל 0 פחות קולות', 'מה אם הליכוד תקבל 9007199254740992 פחות קולות',
    'מה אם הליכוד תקבל -5000 פחות קולות', 'מה אם לא קיימת תקבל 5000 פחות קולות',
    'מה אם הליכוד תקבל 5% פחות קולות', 'מה אם הליכוד תקבל 5000 פחות קולות לעומת הבחירות הקודמות']) assert.ok('error' in parseElectionQuestion(text, context), text);
  assert.deepEqual(query('מה אם הליכוד תקבל 5000 פחות קולות וגם רשימה ב תקבל 5000 יותר קולות'), { kind: 'scenario', voteChanges: [{ party: 'א', delta: -5000 }, { party: 'ב', delta: 5000 }] });
  const ambiguous = { ...context, names: { א: 'שם משותף', ב: 'שם משותף' } };
  assert.ok('error' in parseElectionQuestion('מה אם שם משותף תקבל 1 פחות קולות', ambiguous));
  const nameless = parseElectionQuestion('מה אם א מקבל 1 פחות קולות', { ...context, names: {} });
  assert.ok(!('error' in nameless));
});

test('removing valid votes changes the denominator and seat allocation without mutating other lists or source', async () => {
  const original = structuredClone(context);
  const answer = executeElectionQuestion(query('מה אם הליכוד תקבל 5000 פחות קולות'), context);
  assert.equal(answer.scenario!.voteData.א.votes, 5000);
  assert.equal(answer.scenario!.voteData.ב.votes, 20000);
  assert.equal(Object.values(answer.scenario!.voteData).reduce((sum, entry) => sum + entry.votes, 0), 25000);
  const likud = answer.rows.find(row => row[0] === 'הליכוד')!;
  assert.ok(Number(likud[3]) < 0);
  assert.match(answer.note, /אינם מועברים/);
  assert.deepEqual(context, original);
  const href = await questionScenarioHref(answer, context, '26');
  const decoded = await decodeSharedScenario(href!.split('=')[1], '26');
  assert.equal(decoded.base.voteData.א.votes, 10000);
  assert.equal(decoded.scenario.voteData.א.votes, 5000);
  assert.equal(executeElectionQuestion(query('מה אם הליכוד תקבל 10000 פחות קולות'), context).scenario!.voteData.א.votes, 0);
  assert.equal(executeElectionQuestion(query('מה אם הליכוד תקבל 5000 קולות יותר'), context).scenario!.voteData.א.votes, 15000);
});

test('invalid reductions, unsafe arithmetic and conflicting transfers fail explicitly', () => {
  const run = (delta: number, party = 'א', extra = {}) => executeElectionQuestion({ kind: 'scenario', voteChange: { party, delta }, ...extra } as QuestionQuery, context);
  for (const delta of [-10001, 0, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) assert.throws(() => run(delta));
  assert.throws(() => run(-30000, 'א'));
  assert.throws(() => run(-1, 'לא קיים'), /אינה קיימת/);
  assert.throws(() => run(-1, 'א', { transfer: { from: 'א', to: 'ב', fraction: .5 } }), /העברה/);
  const single = { ...context, votes: { א: { votes: 10000, mandats: 0 } } };
  assert.throws(() => executeElectionQuestion({ kind: 'scenario', voteChange: { party: 'א', delta: -10000 } }, single), /אפס קולות/);
  const big = { ...context, votes: { א: { votes: 10, mandats: 0 }, ב: { votes: Number.MAX_SAFE_INTEGER - 10, mandats: 0 } } };
  assert.throws(() => executeElectionQuestion({ kind: 'scenario', voteChange: { party: 'א', delta: 1 } }, big));
});

test('reduction examples are election-aware, executable and reachable in the existing dropdown', () => {
  const groups = buildQuestionExamples(context);
  const reductions = groups.find(group => group.title === 'ירידה בקולות')!.questions;
  assert.ok(reductions.some(question => question.includes('5,000 פחות קולות')));
  const complete = createQuestionCompletions(context);
  assert.ok(complete('מה היה קורה אם הליכוד').options.some(option => option.value.includes('הייתה מקבלת')));
  assert.ok(complete('מה היה קורה אם הליכוד הייתה מקבלת').options.some(option => option.value.includes('5000 פחות קולות')));
  const tiny = { ...context, votes: { א: { votes: 1, mandats: 0 } } };
  assert.ok(!buildQuestionExamples(tiny).some(group => group.title === 'ירידה בקולות'));
});
