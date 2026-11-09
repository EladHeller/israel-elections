import assert from 'node:assert/strict';
import { test } from 'node:test';
import { questionEntities, replaceQuestionEntity, placeCompletions, type QuestionPlaces } from './question-entities';
import { createQuestionCompletions } from './question-completions';
import { executeElectionQuestion, parseElectionQuestion, type QuestionContext } from './election-questions';

const context: QuestionContext = { electionId: '26', votes: { מחל: { votes: 9000, mandats: 100 }, שס: { votes: 1000, mandats: 20 }, א: { votes: 1, mandats: 0 } },
  names: { מחל: 'הליכוד', שס: 'ש"ס', א: 'רשימה קטנה' }, config: { blockPercentage: .0325, algorithm: 'baderOffer', agreements: [] } };
const places: QuestionPlaces = { localities: [{ id: '1', name: 'ירושלים', validVotes: 100, votes: { מחל: 60, שס: 40 } },
  { id: '2', name: 'תל אביב-יפו', validVotes: 200, votes: { מחל: 150, שס: 50 } }],
  stations: [{ id: '["1","1",0]', name: 'ירושלים', pollingStation: '1', split: 0, validVotes: 100, votes: { מחל: 60, שס: 40 } },
    { id: '["1","1",1]', name: 'ירושלים', pollingStation: '1', split: 1, validVotes: 100, votes: { מחל: 30, שס: 70 } },
    { id: '["1","2",null]', name: 'ירושלים', pollingStation: '2', validVotes: 100, votes: { מחל: 60, שס: 40 } },
    { id: '["2","7",null]', name: 'תל אביב-יפו', pollingStation: '7', validVotes: 200, votes: { מחל: 150, שס: 50 } }] };

test('the word עם stays plain text while the Raam list name remains editable', () => {
  const raamContext = { ...context, votes: { ...context.votes, עם: { votes: 1000, mandats: 4 } }, names: { ...context.names, עם: 'רע"ם' } };
  const input = 'באילו 5 יישובים היה הכי צמוד עם לפחות 1000 קולות כשרים?';
  const entities = questionEntities(input, raamContext);
  assert.deepEqual(entities.map(entity => entity.kind), ['number', 'number']);
  assert.deepEqual(entities.map(entity => input.slice(entity.start, entity.end)), ['5', '1000']);
  assert.equal(entities[1].numeric?.label, 'מינימום קולות');
  assert.ok(!('error' in parseElectionQuestion(input, raamContext)));
  for (const name of ['רעם', 'רע"ם', 'רע״ם']) {
    const question = `כמה קולות קיבלה ${name}?`;
    const party = questionEntities(question, raamContext).find(entity => entity.kind === 'party');
    assert.equal(party?.id, 'עם', name);
    assert.equal(question.slice(party!.start, party!.end), name);
    assert.equal(replaceQuestionEntity(question, party!, 'מחל', raamContext), 'כמה קולות קיבלה הליכוד?');
  }
});

test('locality names complete supported questions, including direct ב prefixes, and stations stay within the city', () => {
  const complete = createQuestionCompletions(context, places);
  for (const text of ['איזו רשימה קבלה הכי הרבה קולות ב', 'איזו רשימה קיבלה הכי הרבה קולות ביישוב ', 'מי ניצחה ביישוב ', 'כמה קולות קיבלה הליכוד ביישוב ', 'כמה קולות קיבלה מחל ב']) {
    assert.equal(complete(text).options.length, 2, text);
    const next = complete(text).options[0].value;
    const parsed = parseElectionQuestion(next, context);
    assert.ok(!('error' in parsed), next);
    if (!('error' in parsed)) assert.ok(executeElectionQuestion(parsed.query, context, places.localities).rows.length);
  }
  assert.equal(complete('איזו רשימה קיבלה הכי הרבה קולות בירו').options[0].label, 'ירושלים');
  const chooseStation = complete('מי ניצחה בירושלים').options[0].value;
  const options = complete(chooseStation).options;
  assert.equal(options.length, 3); assert.ok(options.every(option => option.detail === 'ירושלים'));
  assert.equal(complete('מי ניצחה בירושלים בקלפי 1 פיצול 1').options.length, 0);
  assert.equal(placeCompletions('כמה קולות קיבלה הליכוד', context, places), null);
  assert.equal(complete('מה היה קורה אם').options.length > 0, true);
});

test('chips preserve original UTF-16 spans, quoted names, clitics, and only replace the chosen entity', () => {
  const input = 'כמה קולות קיבלה ש״ס בירושלים בקלפי 1 פיצול 1?';
  const entities = questionEntities(input, context, places);
  assert.deepEqual(entities.map(entity => entity.kind), ['party', 'locality', 'station']);
  assert.deepEqual(entities.map(entity => input.slice(entity.start, entity.end)), ['ש״ס', 'ירושלים', '1 פיצול 1']);
  const changed = replaceQuestionEntity(input, entities[0], 'מחל', context);
  assert.equal(changed, 'כמה קולות קיבלה הליכוד בירושלים בקלפי 1 פיצול 1?');
  assert.equal(replaceQuestionEntity(input, entities[1], '2', context), 'כמה קולות קיבלה ש״ס בתל אביב-יפו?');
  const spaced = input.replace(' בקלפי ', '  בקלפי  ');
  assert.equal(replaceQuestionEntity(spaced, questionEntities(spaced, context, places)[1], '2', context), 'כמה קולות קיבלה ש״ס בתל אביב-יפו?');
  assert.equal(replaceQuestionEntity(input, entities[2], '["1","2",null]', context), 'כמה קולות קיבלה ש״ס בירושלים בקלפי 2?');
  assert.equal(replaceQuestionEntity(input, entities[0], 'missing', context), input);
  const comparison = questionEntities('השווה בין הליכוד לש"ס', context);
  assert.ok(!comparison[0].options.some(option => option.id === 'שס'));
  assert.equal(questionEntities('כמה קולות חסרים לליכוד למנדט נוסף', context)[0].label, 'הליכוד');
  const gap = 'כמה קולות חסרים לליכוד למנדט נוסף';
  assert.equal(replaceQuestionEntity(gap, questionEntities(gap, context)[0], 'א', context), 'כמה קולות חסרים לרשימה קטנה לעבור את אחוז החסימה');
  assert.equal(questionEntities('כמה קולות קיבלה הַליכוד', context)[0].label, 'הליכוד');
});

test('station split choices execute the exact polling station and keep result links precise', () => {
  for (const input of ['מי ניצחה בירושלים בקלפי 1 פיצול 1', 'כמה קולות קיבלה ש"ס בירושלים בקלפי 1 פיצול 1']) {
    const parsed = parseElectionQuestion(input, context);
    assert.ok(!('error' in parsed));
    if ('error' in parsed) continue;
    const answer = executeElectionQuestion(parsed.query, context, places.stations);
    assert.match(String(answer.rows[0]), /ש"ס.*70/);
    assert.equal(answer.rowLinks?.length, 1);
  }
});

test('chip offsets survive whitespace and emoji, aliases stay local, and replacing a below-threshold list restores the seat goal', () => {
  const input = '  🙂  כמה קולות קיבלה הליכוד';
  const entity = questionEntities(input, context)[0];
  assert.equal(input.slice(entity.start, entity.end), 'הליכוד');
  assert.equal(questionEntities('מי ניצחה בתל אביב', context, places)[0].label, 'תל אביב-יפו');
  const ambiguous = { ...context, names: { מחל: 'אותו שם', שס: 'אותו שם', א: 'רשימה קטנה' } };
  assert.equal(questionEntities('כמה קולות קיבלה מחל', ambiguous)[0].options.find(option => option.id === 'שס')!.text, 'שס');
  const inputGap = 'כמה קולות חסרים לרשימה קטנה לעבור את אחוז החסימה';
  assert.equal(replaceQuestionEntity(inputGap, questionEntities(inputGap, context)[0], 'מחל', context), 'כמה קולות חסרים להליכוד למנדט נוסף');
});
