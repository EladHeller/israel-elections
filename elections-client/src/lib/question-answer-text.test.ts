import assert from 'node:assert/strict';
import { test } from 'node:test';
import { questionAnswerText } from './question-answer-text';
import type { Answer, QuestionQuery } from './election-questions';
const answer = (rows: Answer['rows']): Answer => ({ rows, columns: [], note: '' });
test('summaries preserve the answer type, units, thresholds, and search failures', () => {
  assert.deepEqual(questionAnswerText(answer([]), 'results'), []);
  assert.match(questionAnswerText(answer([['הליכוד', '500', '20%', '27']]), 'results')[0], /500.*27 מנדטים/);
  for (const kind of ['insight', 'comparison', 'comparison-scenario'] as const) assert.deepEqual(questionAnswerText(answer([['משפט', 1]]), kind), ['משפט']);
  assert.match(questionAnswerText(answer([['הליכוד', 1000, '20%', 27]]), 'results')[0], /1,000.*20%.*27 מנדטים/);
  for (const kind of ['seat-gap', 'seat-loss'] as const) {
    assert.match(questionAnswerText(answer([['הליכוד', 1000, 27]]), kind)[0], /1,000 קולות/);
    assert.ok(!questionAnswerText(answer([['הליכוד', '—', 27]]), kind)[0].includes('— קולות'));
  }
  assert.match(questionAnswerText(answer([['הליכוד', 0]]), 'gap')[0], /כבר מגיעה/);
  assert.match(questionAnswerText(answer([['הליכוד', 5000]]), 'gap')[0], /5,000 קולות/);
  assert.match(questionAnswerText(answer([['ירושלים', 1000, '60%']]), 'rank')[0], /ירושלים.*1,000.*60%/);
  assert.match(questionAnswerText(answer([['ירושלים', 'רשימה', 1000, '60%', 'רוב']]), 'below-threshold-winners')[0], /רשימה.*1,000.*60%.*רוב/);
  assert.match(questionAnswerText(answer([['הליכוד', 27, 28, 1], ['ישר', 21, 21, 0]]), 'scenario')[0], /מ־27 ל־28 מנדטים/);
  assert.deepEqual(questionAnswerText(answer([['הליכוד', 27, 27, 0]]), 'scenario'), ['חלוקת המנדטים נשארת ללא שינוי.']);
  assert.equal(questionAnswerText(answer([['הליכוד', 0, '0%', 0]]), 'results' as QuestionQuery['kind']).length, 1);
});
