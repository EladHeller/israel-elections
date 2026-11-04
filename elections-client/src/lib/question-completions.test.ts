import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildQuestionExamples } from './question-examples';
import { createQuestionCompletions, questionCompletions } from './question-completions';
import { normalizeQuestion, parseElectionQuestion, type QuestionContext } from './election-questions';
import configs from '../data/elections-config.json';
import names from '../data/party-names.json';
import type { ElectionConfig } from '../types';

const context: QuestionContext = {
  electionId: '26', config: { blockPercentage: .0325, algorithm: 'baderOffer', agreements: [] },
  names: { א: 'רשימה ראשונה', ב: 'רשימה שנייה', ג: 'רשימה שלישית' },
  votes: { א: { votes: 9700, mandats: 0 }, ב: { votes: 300, mandats: 120 }, ג: { votes: 0, mandats: 0 } },
  blocs: { blocks: { group: { label: 'גוש לדוגמה', color: '#000', parties: ['א', 'ב'] } } },
};

test('completions follow edited text, election data and valid-vote threshold, not cached mandats', () => {
  const complete = createQuestionCompletions(context);
  assert.ok(complete('').options.length > 5);
  assert.equal(complete('כמה קולות חסרים ל').options.length, 3);
  assert.deepEqual(complete('כמה קולות חסרים לרשימה ראשונה').options.map(x => x.label), ['למנדט נוסף']);
  assert.deepEqual(complete('כמה קולות חסרים לרשימה שנייה').options.map(x => x.label), ['לעבור את אחוז החסימה']);
  assert.equal(complete('כמה קולות חסרים לרשימה שנייה לעבור את אחוז החסימה').options.length, 0);
  assert.equal(complete('כמה קולות חסרים לרשימה ש').options.length, 2);
  assert.equal(complete('שאלה חופשית לגמרי').options.length, 0);
  assert.equal(complete('מה היה קורה אם').options.some(x => x.detail?.startsWith('גוש')), true);
  assert.equal(complete('מה היה קורה אם רשימה ראשונה מקבלת את כל הקולות של').options.length, 2);
  assert.equal(questionCompletions('', { ...context, electionId: '1' }).options.some(x => /יישוב|קלפי/.test(x.label)), false);
  assert.equal(questionCompletions('', { ...context, votes: {} }).options.length, 0);
  assert.equal(questionCompletions('', { ...context, electionId: undefined }).options.some(x => /יישוב|קלפי/.test(x.label)), false);
  const edge = { ...context, votes: { א: { votes: 9675, mandats: 0 }, ב: { votes: 325, mandats: 0 } } };
  assert.equal(questionCompletions('כמה קולות חסרים לרשימה שנייה', edge).options[0].label, 'למנדט נוסף');
});

test('every offered terminal question parses for every historical election', () => {
  for (const [electionId, config] of Object.entries(configs)) {
    const parties = (names as Record<string, Record<string, string>>)[electionId] ?? {};
    const complete = createQuestionCompletions({ electionId, config: config as ElectionConfig, names: parties,
      votes: Object.fromEntries(Object.keys(parties).map((id, i) => [id, { votes: i === 0 ? 100000 : i, mandats: 0 }])) });
    const pending = ['']; const seen = new Set<string>();
    while (pending.length) {
      const text = pending.pop()!;
      if (seen.has(text)) continue;
      seen.add(text);
      const options = complete(text).options;
      if (options.length) pending.push(...options.map(x => x.value));
      else if (text) {
        const parsed = parseElectionQuestion(text, { electionId, config: config as ElectionConfig, names: parties,
          votes: Object.fromEntries(Object.keys(parties).map((id, i) => [id, { votes: i === 0 ? 100000 : i, mandats: 0 }])) });
        assert.ok(!('error' in parsed), `${electionId}: ${text}: ${JSON.stringify(parsed)}`);
      }
    }
  }
});

test('every displayed example is reachable through dropdown choices in every election', () => {
  for (let election = 1; election <= 26; election++) {
    const id = String(election);
    const ctx: QuestionContext = { electionId: id,
      votes: JSON.parse(readFileSync(`elections-client/public/data/${id}/allResults.json`, 'utf8')).voteData,
      config: (configs as unknown as Record<string, ElectionConfig>)[id],
      names: (names as Record<string, Record<string, string>>)[id] };
    const complete = createQuestionCompletions(ctx);
    for (const question of buildQuestionExamples(ctx).flatMap(group => group.questions)) {
      const target = normalizeQuestion(question);
      let current = '';
      for (let step = 0; current !== target && step < 30; step++) {
        const next = complete(current).options.filter(option => target.startsWith(normalizeQuestion(option.value)))
          .sort((a, b) => b.value.length - a.value.length)[0];
        assert.ok(next, `${id}: cannot reach ${question} after ${current}`);
        current = normalizeQuestion(next.value);
      }
      assert.equal(current, target, `${id}: ${question}`);
    }
  }
});

test('expanded paths cover supported measures, geography, comparisons and every current list', () => {
  const ctx: QuestionContext = { ...context, electionId: '25', names: { ...context.names, א: 'הליכוד' },
    votes: { א: { votes: 9700, mandats: 115 }, ב: { votes: 299, mandats: 5 }, ג: { votes: 1, mandats: 0 } } };
  const complete = createQuestionCompletions(ctx);
  const paths = ['כמה קולות צריכים לרדת ל', 'כמה אחוזים קיבלה', 'כמה מנדטים קיבלה', 'באילו יישובים', 'באילו קלפיות', 'בכמה יישובים'];
  for (const path of paths) assert.ok(complete(path).options.length, path);
  assert.equal(complete('השווה בין').options.length, 3);
  assert.equal(complete('השווה בין רשימה שלישית ל').options.length, 2);
  const questions = buildQuestionExamples(ctx, true).flatMap(group => group.questions);
  assert.ok(questions.some(q => q.includes('רשימה שלישית') && q.startsWith('כמה קולות נוספים')));
  assert.ok(questions.some(q => q.startsWith('בכמה אחוזים עלתה הליכוד')));
  assert.ok(questions.some(q => q.includes('הליכוד התחזקה')));
  assert.ok(complete('מה היה קורה אם הליכוד').options.some(option => option.value.includes('אותו')));
});


test('comparison wording cannot consume a historical ballot letter inside בין', () => {
  const ctx: QuestionContext = { electionId: '21',
    names: (names as Record<string, Record<string, string>>)['21'],
    config: (configs as unknown as Record<string, ElectionConfig>)['21'],
    votes: { פה: { votes: 100, mandats: 0 }, שס: { votes: 100, mandats: 0 }, ין: { votes: 1, mandats: 0 } } };
  const parsed = parseElectionQuestion('השווה בין כחול לבן לש"ס', ctx);
  assert.ok(!('error' in parsed));
  if (!('error' in parsed)) assert.deepEqual(parsed.query, { kind: 'results', parties: ['פה', 'שס'] });
});
