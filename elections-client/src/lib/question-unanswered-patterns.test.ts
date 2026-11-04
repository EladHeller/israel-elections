import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseElectionQuestion, executeElectionQuestion, type QuestionContext, type QuestionQuery } from './election-questions';
import { insightNeedsPlaces } from './question-insights';
import type { LocalityVotes } from './party-research';

const context: QuestionContext = {
  electionId: '26', names: { מחל: 'הליכוד', ט: 'הציונות הדתית וזהות', ך: 'עמך ישראל', עם: 'רע"ם' },
  votes: { מחל: { votes: 500, mandats: 0 }, ט: { votes: 300, mandats: 0 }, ך: { votes: 100, mandats: 0 }, עם: { votes: 100, mandats: 0 } },
  config: { blockPercentage: 0.0325, agreements: [], algorithm: 'baderOffer' },
};
function query(text: string, ctx = context): QuestionQuery {
  const parsed = parseElectionQuestion(text, ctx);
  assert.ok('query' in parsed, `${text}: ${JSON.stringify(parsed)}`);
  return parsed.query;
}
const rejected = (text: string, ctx = context) => assert.ok('error' in parseElectionQuestion(text, ctx), text);

test('observed threshold, geographic, seat-loss and transfer phrasings preserve their operators', () => {
  for (const text of ['מה היה קורה אם אחוז החסימה היה על 1%', 'מה היה קורה אם אחוז החסימה על 1 אחוז', 'מה היה קורב אם אחוז החסימה על 1 אחוז', 'מה היה קורה אם אחוז החסימה יהיה על 1 אחוזים']) {
    assert.deepEqual(query(text), { kind: 'scenario', threshold: 0.01 });
  }
  for (const text of ['באיזו עיר קבלו הציונות הדתית הכי הרבה קולות', 'באיזה עיר הציונות הדתית קיבלו הכי הרבה קולות']) {
    assert.deepEqual(query(text), { kind: 'rank', party: 'ט', level: 'localities', order: 'votes', limit: 1 });
  }
  for (const text of ['באיזה עיר הליכוד קיבלו הכי הרבה קולות', 'באיזה יישוב הליכוד קבלו הכי הרבה קולות']) {
    assert.deepEqual(query(text), { kind: 'rank', party: 'מחל', level: 'localities', order: 'votes', limit: 1 });
  }
  for (const text of ['באיזה עיר הצביעו הכי הרבה לרע"ם', 'באיזה יישוב רעמ קיבלה הכי הרבה קולות?']) {
    assert.deepEqual(query(text), { kind: 'rank', party: 'עם', level: 'localities', order: 'votes', limit: 1 });
  }
  for (const verb of ['יורדים', 'צריכים לרדת']) {
    assert.deepEqual(query(`כמה קולות ${verb} לציונות הדתית כדי שהיא תאבד מנדט`), { kind: 'seat-loss', party: 'ט' });
  }
  for (const [from, to] of [['עמך ישראל', 'הציונות הדתית'], ['הציונות הדתית', 'עמך ישראל']]) {
    const outgoing = query(`מה היה קורה אם הקולות של ${from} היו עוברים ל${to}`);
    assert.deepEqual(outgoing, query(`מה היה קורה אם ${to} הייתה מקבלת את הקולות של ${from}`));
    const before = structuredClone(context);
    const result = executeElectionQuestion(outgoing, context);
    assert.equal(Object.values(result.scenario!.voteData).reduce((n, entry) => n + entry.votes, 0), 1000);
    assert.deepEqual(context, before);
  }
  assert.deepEqual(query('מה היה קורה אם 50% מהקולות של עמך ישראל היו עוברים לציונות הדתית'), { kind: 'scenario', transfer: { from: 'ך', to: 'ט', fraction: 0.5 } });
  for (const text of ['מה היה קורה אם הקולות של הליכוד היו עוברים לליכוד', 'מה היה קורה אם אחוז החסימה היה על 101%', 'מה היה קורה אם אחוז החסימה על 1 אחוז וגם השמש תזרח', 'באיזה עיר הצביעו הכי הרבה לרעם וגם לליכוד', 'כמה קולות יורדים לציונות הדתית כדי שהיא תאבד מנדט ויעברו לליכוד', 'באיזה יישוב רעקיבלה הכי הרבה קולות']) rejected(text);
  rejected('באיזה יישוב רעמ קיבלה הכי הרבה קולות', { ...context, names: { ...context.names, עם: 'רשימה אחרת' } });
});

test('comparison variants preserve list, previous election and votes versus both percentage measures', () => {
  const cases = [
    ['בכמה אחוזים גדלה הציונות הדתית מהבחירות הקודמות', 'ט', 'both'],
    ['בכמה קולות עלו הליכוד מהבחירות הקודמות', 'מחל', 'votes'],
    ['כמה אחוזים קבלו הליכוד יותר מהבחירות הקודמות', 'מחל', 'both'],
    ['כמה קולות עלתה רע"ם מהבחירות האחרונות', 'עם', 'votes'],
    ['כמה קולות עלתה הליכוד מהבחירות האחרונות', 'מחל', 'votes'],
    ['בכמה אחוזים הליכוד גדלה מהבחירות הקודמות', 'מחל', 'both'],
  ];
  for (const [text, id, measure] of cases) {
    assert.deepEqual(query(text), { kind: 'comparison', source: '25', target: { type: 'list', id }, measure });
  }
  const previous = { id: '25', names: context.names, votes: { מחל: { votes: 300, mandats: 0 }, ט: { votes: 300, mandats: 0 }, ך: { votes: 200, mandats: 0 }, עם: { votes: 200, mandats: 0 } }, config: context.config };
  const result = executeElectionQuestion(query(cases[2][0]), { ...context, comparison: previous });
  assert.match(String(result.rows[0][0]), /20 נקודות אחוז/);
  assert.match(String(result.rows[0][0]), /66.67%/);
  assert.match(String(executeElectionQuestion(query(cases[1][0]), { ...context, comparison: previous }).rows[0][0]), /200 קולות/);
  for (const text of ['כמה קולות עלתה הליכוד מהבחירות האחרונות וגם שס', 'בכמה אחוזים גדלה הציונות הדתית מהבחירות הקודמות בירושלים']) rejected(text);
});

test('local votes use the named locality or station, report zero, and reject missing or ambiguous places', () => {
  const places: LocalityVotes[] = [
    { id: '1', name: 'נתניה', validVotes: 100, votes: { עם: 7, מחל: 93 } },
    { id: '2', name: 'תל אביב', validVotes: 200, votes: { מחל: 80 } },
  ];
  const q = query('כמה קולות קיבלה רע"ם בנתניה?');
  assert.ok(insightNeedsPlaces(q));
  assert.match(String(executeElectionQuestion(q, context, places).rows[0][0]), /רע"ם קיבלה 7 קולות.*7.00%/);
  assert.match(String(executeElectionQuestion(query('כמה קולות קבלה הליכוד בתל אביב'), context, places).rows[0][0]), /80 קולות.*40.00%/);
  assert.match(String(executeElectionQuestion(query('כמה קולות קיבלה רע"ם בתל אביב'), context, places).rows[0][0]), /0 קולות.*0.00%/);
  const fullCityName = [{ ...places[1], name: 'תל אביב - יפו' }];
  assert.match(String(executeElectionQuestion(query('כמה קולות קבלה הליכוד בתל אביב'), context, fullCityName).rows[0][0]), /תל אביב - יפו.*80 קולות/);
  assert.throws(() => executeElectionQuestion(query('כמה קולות קבלה הליכוד בתל אביב'), context, [...fullCityName, fullCityName[0]]), /חד משמעי/);
  const station = query('כמה קולות קיבלה רע"ם בנתניה בקלפי 2');
  assert.ok('level' in station && station.level === 'stations');
  const stations = places.map(p => ({ ...p, pollingStation: '2' }));
  assert.match(String(executeElectionQuestion(station, context, stations).rows[0][0]), /נתניה — קלפי 2/);
  assert.throws(() => executeElectionQuestion(q, context), /זמינים/);
  assert.throws(() => executeElectionQuestion(q, context, []), /לא נמצא/);
  assert.throws(() => executeElectionQuestion(q, context, [...places, places[0]]), /חד משמעי/);
  assert.throws(() => executeElectionQuestion(station, context, [...stations, { ...stations[0], split: 1 }]), /חד משמעי/);
  assert.throws(() => executeElectionQuestion(q, context, [{ ...places[0], validVotes: 0 }]), /אין קולות כשרים/);
});

test('national winner requires no geographic data and retains all tied lists', () => {
  const q = query('איזו רשימה קבלה הכי הרבה קולות');
  assert.equal(insightNeedsPlaces(q), false);
  assert.match(String(executeElectionQuestion(q, context).rows[0][0]), /הליכוד במקום הראשון בארץ.*500/);
  const tied = { ...context, votes: { ...context.votes, ט: { votes: 500, mandats: 0 } } };
  const tiedText = String(executeElectionQuestion(q, tied).rows[0][0]);
  for (const expected of ['הליכוד', 'הציונות הדתית וזהות', 'בתיקו']) assert.ok(tiedText.includes(expected));
  assert.match(String(executeElectionQuestion(q, { ...context, names: {} }).rows[0][0]), /מחל/);
  assert.equal(query('איזו מפלגה קבלה הכי הרבה קולות בדפנה').kind, 'insight');
  assert.throws(() => executeElectionQuestion(q, { ...context, votes: {} }), /קולות כשרים/);
});

test('eligible-voter ranking differs from turnout, includes places without valid votes and handles absent data', () => {
  const q = query('באיזו קלפי יש הכי הרבה בעלי זכות הצבעה');
  assert.ok(insightNeedsPlaces(q));
  const places: LocalityVotes[] = [
    { id: '1', name: 'גדולה', pollingStation: '1', validVotes: 0, voters: 0, eligibleVoters: 2000, votes: {} },
    { id: '2', name: 'מצביעה', pollingStation: '2', validVotes: 900, voters: 900, eligibleVoters: 1000, votes: { מחל: 900 } },
    { id: '3', name: 'חסרה', pollingStation: '3', validVotes: 100, votes: {} },
  ];
  assert.match(String(executeElectionQuestion(q, context, places).rows[0][0]), /גדולה.*2,000 בעלי זכות/);
  const turnout = query('באיזה קלפי שיעור ההצבעה היה הכי גבוה');
  assert.match(String(executeElectionQuestion(turnout, context, places).rows[0][0]), /מצביעה.*90.00%/);
  const plural = query('באילו קלפיות יש הכי הרבה בעלי זכות בחירה');
  assert.equal(executeElectionQuestion(plural, context, places).rows.length, 2);
  const locality = query('באיזה יישוב יש הכי הרבה בעלי זכות הצבעה');
  assert.ok('level' in locality && locality.level === 'localities');
  assert.match(String(executeElectionQuestion(locality, context, places).rows[0][0]), /גדולה/);
  const ties = [{ ...places[0], id: 'b', name: 'ב' }, { ...places[0], id: 'a', name: 'א' }, { ...places[0], id: 'a', name: 'ג' }];
  assert.match(String(executeElectionQuestion(q, context, ties).rows[0][0]), /^א/);
  assert.equal(executeElectionQuestion(q, context, []).rows.length, 0);
  for (const eligibleVoters of [undefined, 0, -1, NaN, 1.5]) assert.throws(() => executeElectionQuestion(q, context, [{ ...places[0], eligibleVoters }]), /אין נתוני בעלי זכות/);
  rejected('באיזו קלפי יש הכי הרבה בעלי זכות הצבעה וגם הכי הרבה מצביעים');
});
