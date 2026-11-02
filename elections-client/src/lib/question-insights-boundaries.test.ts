import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeElectionQuestion } from './election-questions';
import type { QuestionContext } from './election-questions';
import type { InsightQuery } from './question-insights';

const query: InsightQuery = { kind: 'insight', metric: 'threshold-entry', party: 'target', level: 'localities', minimum: 100, limit: 10, byVotes: false };

test('threshold entry corrects floating-point rounding to the first vote accepted by the seat engine', () => {
  const context: QuestionContext = {
    votes: { other: { votes: 3, mandats: 0 }, target: { votes: 0, mandats: 0 } },
    names: {}, config: { blockPercentage: 0.4, agreements: [], algorithm: 'baderOffer' },
  };
  // The closed-form ceil gives 3 because of binary floating-point rounding;
  // 2 new votes already meet the seat engine's threshold: 2 >= 5 * 0.4.
  assert.equal(Math.ceil(0.4 * 3 / 0.6), 3);
  const answer = executeElectionQuestion(query, context);
  assert.match(String(answer.rows[0][0]), /2 קולות חדשים/);
  assert.ok(answer.rows.some(row => String(row[0]).startsWith('target מקבלת')));
  assert.equal(context.votes.target.votes, 0);
});

test('reaching a very small threshold can leave seats unchanged and reports that result explicitly', () => {
  const context: QuestionContext = {
    votes: { other: { votes: 999, mandats: 0 }, target: { votes: 0, mandats: 0 } },
    names: {}, config: { blockPercentage: 0.0001, agreements: [], algorithm: 'baderOffer' },
  };
  const answer = executeElectionQuestion(query, context);
  assert.match(String(answer.rows[0][0]), /1 קולות חדשים/);
  assert.match(String(answer.rows[1][0]), /ללא שינוי/);
});

test('insight result limits reject integers larger than JavaScript can represent exactly', async () => {
  const { parseElectionQuestion } = await import('./election-questions');
  const context: QuestionContext = { votes: { a: { votes: 1, mandats: 0 } }, names: {}, config: { blockPercentage: 0.0325, agreements: [], algorithm: 'baderOffer' } };
  assert.ok('error' in parseElectionQuestion('באילו 999999999999999999 יישובים היה הכי צמוד', context));
});
