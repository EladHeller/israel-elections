import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createQuestionCompletions, questionCompletions } from './question-completions';
import { parseElectionQuestion, type QuestionContext } from './election-questions';
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
  assert.equal(complete('').options.length, 5);
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
