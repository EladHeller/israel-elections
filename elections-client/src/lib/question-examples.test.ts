import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildQuestionExamples, selectQuestionExamples } from './question-examples';
import { parseElectionQuestion, type QuestionContext } from './election-questions';
import configs from '../data/elections-config.json';
import names from '../data/party-names.json';
import type { ElectionConfig, PartyNames } from '../types';

const context = (id: string): QuestionContext => ({ electionId: id,
  votes: JSON.parse(readFileSync(`elections-client/public/data/${id}/allResults.json`, 'utf8')).voteData,
  config: (configs as unknown as Record<string, ElectionConfig>)[id], names: (names as Record<string, PartyNames>)[id] });

test('catalog spans supported intents in every election and respects historical data availability', () => {
  for (let id = 1; id <= 26; id++) {
    const ctx = context(String(id));
    // The committed 26th-election snapshot is pre-counting; simulate received votes.
    if (id === 26) Object.values(ctx.votes).forEach((entry, index) => { entry.votes = 10000 - index * 100; entry.mandats = index < 3 ? 10 : 0; });
    const groups = buildQuestionExamples(ctx);
    const questions = groups.flatMap(group => group.questions);
    assert.ok(questions.length >= 20, `election ${id}: ${questions.length}`);
    assert.equal(new Set(questions).size, questions.length);
    for (const question of questions) {
      const parsed = parseElectionQuestion(question, ctx);
      assert.ok(!('error' in parsed), `${id}: ${question}`);
      if ('error' in parsed) continue;
      if ('party' in parsed.query && parsed.query.party !== undefined) assert.ok(Object.hasOwn(ctx.votes, parsed.query.party));
      if ('parties' in parsed.query) for (const party of parsed.query.parties) assert.ok(Object.hasOwn(ctx.votes, party));
    }
    assert.equal(groups.some(group => group.title === 'יישובים'), id >= 15);
    assert.equal(groups.some(group => group.title === 'קלפיות'), id >= 15);
    assert.equal(groups.some(group => group.title === 'השוואה לבחירות הקודמות'), id > 1);
    if (id < 26) assert.ok(!questions.some(question => question.includes('עמך ישראל')));
  }
  assert.ok(buildQuestionExamples(context('25')).flatMap(group => group.questions).length >= 60);
});

test('four stable random examples cover different categories; remainder contains every other question once', () => {
  const groups = buildQuestionExamples(context('25'));
  const all = groups.flatMap(group => group.questions);
  const first = selectQuestionExamples(groups, 123);
  assert.equal(first.featured.length, 4);
  assert.equal(new Set(first.featured.map(question => groups.findIndex(group => group.questions.includes(question)))).size, 4);
  assert.deepEqual(first, selectQuestionExamples(groups, 123));
  assert.notDeepEqual(first.featured, selectQuestionExamples(groups, 456).featured);
  const combined = [...first.featured, ...first.remaining.flatMap(group => group.questions)];
  assert.deepEqual(combined.sort(), [...all].sort());
  assert.deepEqual(groups.flatMap(group => group.questions), all);
  assert.deepEqual(selectQuestionExamples([], 1), { featured: [], remaining: [] });
  assert.equal(selectQuestionExamples([{ title: 'one', questions: ['a', 'b', 'c', 'd', 'e'] }], 1).featured.length, 4);
  assert.deepEqual(buildQuestionExamples({ ...context('25'), votes: {} }), []);
});

test('small or incomplete snapshots still offer usable national questions without invented lists', () => {
  const ctx: QuestionContext = { votes: { אב: { votes: 100, mandats: 120 } }, names: {}, config: { blockPercentage: .01, agreements: [], algorithm: 'baderOffer' } };
  const groups = buildQuestionExamples(ctx);
  assert.ok(groups.flatMap(group => group.questions).includes('כמה קולות קיבלה אב?'));
  assert.ok(!groups.flatMap(group => group.questions).some(question => question.includes('היו עוברים')));
  assert.ok(groups.every(group => !['יישובים', 'קלפיות', 'השוואה לבחירות הקודמות'].includes(group.title)));
  assert.equal(selectQuestionExamples([{ title: 'empty', questions: [] }, { title: 'small', questions: ['a', 'b'] }], 9).featured.length, 2);
});
