import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseElectionQuestion, executeElectionQuestion, type QuestionContext } from './election-questions';
import { questionScenarioHref } from './question-scenario';
import { decodeSharedScenario } from './shared-scenario';
import { computeScenarioResults } from './scenario';

const context: QuestionContext = {
  electionId: '26', names: { a: 'רע״ם', b: 'הרשימה המשותפת', c: 'הליכוד', d: 'ש״ס' },
  votes: Object.fromEntries(['a', 'b', 'c', 'd'].map((id, i) => [id, { votes: (i + 1) * 10000, mandats: 0 }])),
  config: { algorithm: 'baderOffer', blockPercentage: 0.0325, agreements: [['c', 'd']] },
};

test('zero two lists and change threshold together, in any order, preserving the shared scenario', async () => {
  const original = structuredClone(context);
  const clauses = ['רעם לא הייתה מקבלת קולות', 'הרשימה המשותפת לא הייתה מקבלת קולות', 'אחוז החסימה היה אחוז אחד'];
  for (const parts of [clauses, [...clauses].reverse()]) {
    const parsed = parseElectionQuestion(`מה היה קורה אם ${parts.join(' וגם ')}`, context);
    assert.ok('query' in parsed, JSON.stringify(parsed));
    assert.match(parsed.explanation, /איפוס קולות רע״ם/);
    assert.match(parsed.explanation, /איפוס קולות הרשימה המשותפת/);
    assert.match(parsed.explanation, /1%/);
    const answer = executeElectionQuestion(parsed.query, context);
    assert.deepEqual(Object.values(answer.scenario!.voteData).map(v => v.votes), [0, 0, 30000, 40000]);
    assert.equal(answer.scenario!.config.blockPercentage, 0.01);
    const href = await questionScenarioHref(answer, context, '26');
    const decoded = await decodeSharedScenario(href!.split('=')[1], '26');
    assert.equal(decoded.scenario.voteData.a.votes, 0);
    assert.equal(decoded.scenario.voteData.b.votes, 0);
    assert.equal(decoded.scenario.config.blockPercentage, 0.01);
    const expected = computeScenarioResults(answer.scenario!.voteData, answer.scenario!.config).realResults;
    for (const row of answer.rows) {
      const id = Object.keys(context.names).find(id => context.names[id] === row[0])!;
      assert.equal(row[2], expected[id]?.mandats ?? 0);
    }
  }
  assert.deepEqual(context, original);
});

test('compose formatted vote changes, zeroing, transfer and agreement removal on distinct lists', () => {
  for (const clause of ['ש״ס הייתה מקבלת 5,000 יותר קולות', 'כל הקולות של ש״ס היו עוברים לליכוד']) {
    const parsed = parseElectionQuestion(`מה היה קורה אם רעם לא הייתה מקבלת קולות וגם ${clause} וגם בלי הסכמי עודפים`, context);
    assert.ok('query' in parsed, JSON.stringify(parsed));
    const answer = executeElectionQuestion(parsed.query, context);
    assert.equal(answer.scenario!.voteData.a.votes, 0);
    assert.deepEqual(answer.scenario!.config.agreements, []);
    assert.equal(answer.scenario!.voteData.d.votes, clause.includes('יותר') ? 45000 : 0);
  }
});

test('reject unknown, conflicting, incomplete and malformed clauses without a partial answer', () => {
  for (const clause of ['השמש תזרח', 'רעם הייתה מקבלת 100 יותר קולות', 'רעם לא הייתה מקבלת קולות', 'כל הקולות של רעם היו עוברים לליכוד', 'ש״ס הייתה מקבלת 1,00 פחות קולות', '', 'אחוז החסימה היה 1% וגם אחוז החסימה היה 2%']) {
    const parsed = parseElectionQuestion(`מה היה קורה אם רעם לא הייתה מקבלת קולות וגם ${clause}`, context);
    assert.ok('error' in parsed, JSON.stringify(parsed));
    assert.match(parsed.error, /תנאי/);
  }
});

test('reject removing all valid votes and combined overflow', () => {
  const parsed = parseElectionQuestion(`מה היה קורה אם ${Object.values(context.names).map(name => `${name} לא הייתה מקבלת קולות`).join(' וגם ')}`, context);
  assert.ok('query' in parsed);
  assert.throws(() => executeElectionQuestion(parsed.query, context), /אפס קולות/);
  assert.throws(() => executeElectionQuestion({ kind: 'scenario', voteChanges: [{ party: 'a', delta: Number.MAX_SAFE_INTEGER - 100000 }, { party: 'b', delta: 100000 }] }, context), /טווח/);
});
