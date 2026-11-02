import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeElectionQuestion as execute, parseElectionQuestion as parse, type QuestionContext, type QuestionQuery } from './election-questions';
import { executeComparison, matchingList, type ElectionSnapshot } from './election-comparisons';
import { computeScenarioResults } from './scenario';
import { loadComparisonElection } from './comparison-data';
import allNames from '../data/party-names.json';
import allManifests from '../data/elections-manifests.json';
import type { ElectionManifest } from '../types';

const config = { blockPercentage: 0.0325, algorithm: 'baderOffer' as const, agreements: [] as [string, string][] };
const votes = (entries: Record<string, number>) => Object.fromEntries(Object.entries(entries).map(([id, value]) => [id, { votes: value, mandats: 0 }]));
const old: ElectionSnapshot = { id: '25', config, votes: votes({ old: 150, other: 650, a: 100, b: 100 }), names: { old: 'הליכוד', other: 'ישראל ביתנו', a: 'רשימה א', b: 'רשימה ב' }, blocs: { blocks: { gushC: { label: 'המפלגות הערביות', color: '', parties: ['a', 'b'] } } } };
const context: QuestionContext = { electionId: '26', config, votes: votes({ new: 180, other: 520, c: 200, d: 100 }), names: { new: 'הליכוד', other: 'ישראל ביתנו', c: 'רשימה ג', d: 'רשימה ד' }, blocs: { blocks: { gushC: { label: 'המפלגות הערביות', color: '', parties: ['c', 'd'] } } }, comparison: old };
const query = (text: string, ctx = context): QuestionQuery => {
  const result = parse(text, ctx); assert.ok('query' in result, `${text}: ${JSON.stringify(result)}`); return result.query;
};
const answer = (text: string, ctx = context) => execute(query(text, ctx), ctx);
const sentence = (text: string, ctx = context) => answer(text, ctx).rows.map(row => row[0]).join(' ');

test('Hebrew comparison grammar covers explicit/implicit measures, blocs and numeric/spelled elections', () => {
  for (const source of ['הבחירות הקודמות', 'פעם שעברה', 'הכנסת ה־25', 'כנסת 25', 'הכנסת העשרים וחמש', 'הבחירות לכנסת 25']) {
    for (const wording of ['בכמה אחוזים עלתה הליכוד', 'בכמה אחוזים הליכוד עלתה', 'בכמה התחזקה רשימת ישראל ביתנו', 'בכמה קולות ירדה ישראל ביתנו', 'בכמה נקודות אחוז עלתה הליכוד', 'בכמה אחוזים יחסיים עלתה הליכוד', 'בכמה מנדטים עלתה הליכוד', 'בכמה אחוזים הרשימות הערביות עלו']) {
      const q = query(`${wording} לעומת ${source}?`);
      assert.equal(q.kind, 'comparison'); assert.equal('source' in q && q.source, '25');
    }
  }
  for (const wording of ['איזו רשימה עלתה הכי הרבה באחוז הקולות', 'איזו רשימה ירדה הכי הרבה באחוזים', 'מי התחזקה הכי הרבה', 'איזו רשימה עלתה הכי הרבה באחוזים יחסיים']) assert.equal(query(`${wording} לעומת הבחירות הקודמות`).kind, 'comparison');
  for (const text of ['בכמה אחוזים עלתה הליכוד לעומת הבחירות הקודמות וגם שס', 'בכמה אחוזים עלתה הליכוד לעומת כנסת 26', 'בכמה אחוזים עלתה הליכוד לעומת כנסת 27', 'בכמה אחוזים עלתה הליכוד לעומת כנסת 0', 'בכמה אחוזים עלתה הליכוד לעומת שנת 2022', 'בכמה אחוזים עלתה רשימה לא מוכרת לעומת הבחירות הקודמות']) assert.ok('error' in parse(text, context), text);
  assert.ok('error' in parse('בכמה אחוזים עלתה הליכוד לעומת הבחירות הקודמות', { ...context, electionId: '1' }));
  assert.equal(query('באילו יישובים הליכוד התחזקה הכי הרבה מאז הבחירות הקודמות').kind, 'insight');
});

test('percentage ambiguity returns points and relative share, explicit metrics return only requested change', () => {
  const text = sentence('בכמה אחוזים עלתה הליכוד לעומת הבחירות הקודמות');
  assert.match(text, /15%.*18%.*3 נקודות אחוז.*20%/);
  const points = sentence('בכמה נקודות אחוז עלתה הליכוד לעומת הבחירות הקודמות');
  assert.match(points, /3 נקודות אחוז/); assert.ok(!points.includes('יחסי'));
  const relative = sentence('בכמה אחוזים יחסיים עלתה הליכוד לעומת הבחירות הקודמות');
  assert.match(relative, /20%/); assert.ok(!relative.includes('נקודות אחוז'));
  assert.match(sentence('בכמה קולות עלתה הליכוד לעומת הבחירות הקודמות'), /150.*180.*30 קולות/);
  assert.match(sentence('בכמה אחוזים עלתה ישראל ביתנו לעומת הבחירות הקודמות'), /ירידה של 13 נקודות אחוז.*קיטון יחסי של 20%/);
  assert.match(sentence('בכמה מנדטים עלתה הליכוד לעומת הבחירות הקודמות'), /מנדטים/);
  const zero = { ...context, comparison: { ...old, votes: votes({ old: 0, other: 800, a: 100, b: 100 }) } };
  assert.match(sentence('בכמה אחוזים עלתה הליכוד לעומת הבחירות הקודמות', zero), /לא ניתן לחשב שינוי יחסי מבסיס אפס/);
  const unchanged = { ...context, votes: votes({ new: 300, other: 1300, c: 200, d: 200 }) };
  assert.match(sentence('בכמה אחוזים עלתה הליכוד לעומת הבחירות הקודמות', unchanged), /ללא שינוי/);
});

test('list matching rejects ballot reuse, duplicate names, missing data and mergers; rankings exclude them', () => {
  assert.equal(matchingList('new', context, old), 'old');
  assert.throws(() => matchingList('c', context, old), /התאמה חד משמעית/);
  assert.throws(() => matchingList('new', { ...context, names: {} }, old), /התאמה/);
  assert.throws(() => matchingList('new', { ...context, names: { ...context.names, c: 'הליכוד' } }, old), /התאמה/);
  assert.throws(() => matchingList('new', context, { ...old, names: { ...old.names, a: 'הליכוד' } }), /התאמה/);
  assert.throws(() => execute(query('בכמה אחוזים עלתה הליכוד לעומת הבחירות הקודמות'), { ...context, comparison: undefined }), /אינם זמינים/);
  assert.match(sentence('איזו רשימה עלתה הכי הרבה באחוז הקולות לעומת הבחירות הקודמות'), /הליכוד/);
  assert.match(sentence('איזו רשימה ירדה הכי הרבה באחוז הקולות לעומת הבחירות הקודמות'), /ישראל ביתנו/);
  const tied = { ...context, votes: votes({ new: 200, other: 700, c: 50, d: 50 }) };
  assert.equal(answer('איזו רשימה עלתה הכי הרבה באחוז הקולות לעומת הבחירות הקודמות', tied).rows.length, 2);
  assert.match(answer('בכמה אחוזים הרשימות הערביות עלו לעומת הבחירות הקודמות').note, /רשימה ג.*רשימה ד.*רשימה א.*רשימה ב/);
  assert.match(sentence('בכמה אחוזים הרשימות הערביות עלו לעומת הבחירות הקודמות'), /20%.*30%.*10 נקודות אחוז.*50%/);
  assert.throws(() => answer('בכמה אחוזים הרשימות הערביות עלו לעומת הבחירות הקודמות', { ...context, comparison: { ...old, blocs: undefined } }), /הגדרת גוש/);
});

test('restoration and removal scenarios preserve others and allocate integer bloc votes deterministically', () => {
  const before = structuredClone(context);
  for (const target of ['הליכוד', 'המפלגות הערביות', 'הרשימות הערביות']) {
    for (const source of ['הבחירות הקודמות', 'בכנסת 25', 'בכנסת העשרים וחמש', 'בבחירות הקודמות']) {
      for (const metric of ['מספר קולות', 'אחוז מהקולות']) assert.equal(query(`מה היה קורה אם ${target} היו מקבלות אותו ${metric} כמו ${source}`).kind, 'comparison-scenario');
    }
  }
  const restored = answer('מה היה קורה אם הרשימות הערביות היו מקבלות אותו מספר קולות כמו בכנסת 25');
  assert.match(String(restored.rows[0][0]), /300.*200.*22.22%/);
  const expectedVotes = votes({ new: 180, other: 520, c: 133, d: 67 });
  const expected = computeScenarioResults(expectedVotes, config).realResults;
  const baseline = computeScenarioResults(context.votes, config).realResults;
  for (const id of Object.keys(context.votes)) {
    const from = baseline[id]?.mandats ?? 0; const to = expected[id]?.mandats ?? 0;
    if (from !== to) assert.ok(restored.rows.some(row => row[0] === `${context.names[id]} ${to > from ? 'מקבלת' : 'מאבדת'} ${Math.abs(to - from)} מנדטים: מ־${from} ל־${to}.`));
  }
  assert.match(sentence('מה היה קורה אם הרשימות הערביות היו מקבלות אותו אחוז כמו הבחירות הקודמות'), /300.*175.*20%/);
  assert.match(sentence('מה היה קורה אם הליכוד הייתה מקבלת אותו מספר קולות כמו הבחירות הקודמות'), /180.*150/);
  assert.match(sentence('מה היה קורה אם המפלגות הערביות לא היו מקבלות קולות בכלל'), /300.*0 קולות/);
  assert.match(sentence('מה היה קורה אם הליכוד הייתה מקבלת אפס קולות'), /180.*0 קולות/);
  assert.deepEqual(context, before);
  const all = { ...context, votes: votes({ new: 100 }), names: { new: 'הליכוד' } };
  assert.throws(() => answer('מה היה קורה אם הליכוד הייתה מקבלת אפס קולות', all), /תקינים/);
  const noSupport = { ...context, votes: votes({ new: 100, c: 0, d: 0 }) };
  assert.throws(() => answer('מה היה קורה אם הרשימות הערביות היו מקבלות אותו מספר קולות כמו הבחירות הקודמות', noSupport), /אין תמיכה קיימת/);
  const fullOld = { ...context, comparison: { ...old, votes: votes({ old: 100 }) } };
  assert.throws(() => answer('מה היה קורה אם הליכוד הייתה מקבלת אותו אחוז כמו הבחירות הקודמות', fullOld), /100%/);
  assert.ok('error' in parse('מה היה קורה אם הרשימות הערביות לא היו מקבלות קולות בכלל וגם אחוז החסימה היה 2%', context));
  assert.throws(() => executeComparison({ kind: 'comparison-scenario', target: { type: 'list', id: 'absent' }, mode: 'zero' }, context), /אינה קיימת/);
});

test('comparison loader uses national snapshots, propagates cancellation and rejects bad historical data', async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), '/data/25/allResults.json'); assert.equal(options?.signal, controller.signal);
      return new Response(JSON.stringify({ voteData: { מחל: { votes: 100, mandats: 0 }, חיצוניות: { votes: 50, mandats: 0 } } }));
    };
    const loaded = await loadComparisonElection('25', controller.signal);
    assert.equal(loaded.votes['מחל'].votes, 100); assert.equal(loaded.votes['חיצוניות'], undefined);
    await assert.rejects(() => loadComparisonElection('999', controller.signal), /אין נתוני/);
    globalThis.fetch = async () => new Response('', { status: 404 });
    await assert.rejects(() => loadComparisonElection('25', controller.signal), /לא הצלחתי לטעון/);
    globalThis.fetch = async () => new Response(JSON.stringify({ voteData: { a: { votes: -1 } } }));
    await assert.rejects(() => loadComparisonElection('25', controller.signal), /אינם תקינים/);
    globalThis.fetch = async () => new Response(JSON.stringify({}));
    await assert.rejects(() => loadComparisonElection('25', controller.signal), /אינם תקינים/);
    controller.abort(); globalThis.fetch = async () => { throw new Error('cancelled'); };
    await assert.rejects(() => loadComparisonElection('25', controller.signal), /cancelled/);
  } finally { globalThis.fetch = original; }
});

test('edge cases keep missing identity, empty groups, rounding and undefined relative growth explicit', () => {
  for (const text of ['מה היה קורה אם לא מוכרת לא הייתה מקבלת קולות', 'מה היה קורה אם לא מוכרת הייתה מקבלת אותו אחוז כמו הבחירות הקודמות', 'מה היה קורה אם הליכוד הייתה מקבלת אותו אחוז כמו כנסת 99', 'בכמה אחוזים עלתה הליכוד לעומת כנסת לאידוע', 'מה עם הליכוד לעומת הבחירות הקודמות']) assert.ok('error' in parse(text, context));
  for (const source of ['25', 'העשרים וחמש']) assert.equal(query(`מה היה קורה אם הליכוד הייתה מקבלת אותו אחוז כמו ${source}`).kind, 'comparison-scenario');
  assert.equal(query('איזו רשימה עלתה הכי הרבה באחוזים').kind, 'comparison');
  assert.ok('error' in parse('בכמה אחוזים עלתה הליכוד לעומת הבחירות הקודמות', { ...context, blocs: undefined, names: { new: 'הליכוד', other: 'הליכוד' } }));
  const custom = { ...context, blocs: { blocks: { custom: { label: 'קבוצה שלי', color: '', parties: ['new'] } } } };
  assert.equal(query('מה היה קורה אם קבוצה שלי הייתה מקבלת אפס קולות', custom).kind, 'comparison-scenario');
  const zeroQuery = { kind: 'comparison-scenario' as const, target: { type: 'bloc' as const, id: 'gushC' }, mode: 'zero' as const };
  const withoutNames = { ...context, names: {}, comparison: undefined, electionId: undefined };
  assert.match(String(executeComparison(zeroQuery, withoutNames).rows[0][0]), /300.*0 קולות/);
  assert.match(executeComparison(zeroQuery, withoutNames).note, /c, d/);
  assert.throws(() => executeComparison(zeroQuery, { ...context, blocs: { blocks: { gushC: { label: 'x', color: '', parties: [] } } } }), /אין נתוני רשימות/);
  assert.throws(() => executeComparison(zeroQuery, { ...context, blocs: { blocks: { gushC: { label: 'x', color: '', parties: ['c', 'c'] } } } }), /הגדרת גוש/);
  const noSupport = { ...context, votes: votes({ new: 100, c: 0, d: 0 }) };
  assert.match(String(executeComparison(zeroQuery, noSupport).rows[1][0]), /ללא שינוי/);
  assert.match(String(executeComparison({ kind: 'comparison-scenario', target: { type: 'list', id: 'new' }, mode: 'zero' }, { ...context, names: {} }).rows[0][0]), /new/);
  const full = { ...context, votes: votes({ new: 100 }), comparison: { ...old, votes: votes({ old: 200 }) } };
  assert.match(sentence('מה היה קורה אם הליכוד הייתה מקבלת אותו אחוז כמו הבחירות הקודמות', full), /100%.*ללא שינוי/);
  assert.throws(() => answer('מה היה קורה אם הליכוד הייתה מקבלת אותו אחוז כמו הבחירות הקודמות', { ...context, votes: votes({ new: 100 }) }), /אין קולות לרשימות אחרות/);
  const nearFull = { ...context, votes: votes({ new: 1, other: 1_000_000_000 }), comparison: { ...old, votes: votes({ old: 1_000_000_000, other: 1 }) } };
  assert.throws(() => answer('מה היה קורה אם הליכוד הייתה מקבלת אותו אחוז כמו הבחירות הקודמות', nearFull), /טווח החישוב/);
  assert.throws(() => executeComparison(zeroQuery, { ...context, votes: votes({ c: -1, d: 100 }) }), /תקינים/);
  const oldZero = { ...context, comparison: { ...old, votes: votes({ old: 0, other: 800, a: 100, b: 100 }) } };
  assert.equal(answer('איזו רשימה עלתה הכי הרבה באחוזים יחסיים', oldZero).rows.length, 0);
  assert.throws(() => executeComparison({ kind: 'comparison', source: '26', target: { type: 'list', id: 'new' }, measure: 'both' }, context), /אינם זמינים/);
  const low = { ...context, votes: votes({ new: 0, other: 999, c: 1, d: 0 }), comparison: { ...old, votes: votes({ old: 0, other: 1000, a: 0, b: 0 }) } };
  assert.match(sentence('בכמה מנדטים עלתה הליכוד לעומת הבחירות הקודמות', low), /ללא שינוי/);
  assert.match(sentence('מה היה קורה אם הרשימות הערביות היו מקבלות אותו אחוז כמו הבחירות הקודמות', low), /0 קולות/);
  const tiedAllocation = { ...context, votes: votes({ new: 1, c: 100, d: 100 }) };
  assert.ok(answer('מה היה קורה אם הרשימות הערביות היו מקבלות אותו מספר קולות כמו הבחירות הקודמות', tiedAllocation).rows.length);
  const unknownPreviousNames = { ...old, names: { ...old.names } }; delete unknownPreviousNames.names.a;
  assert.equal(matchingList('new', context, unknownPreviousNames), 'old');
  const unknownCurrentNames = { ...context, names: { ...context.names } }; delete unknownCurrentNames.names.c;
  assert.equal(matchingList('new', unknownCurrentNames, old), 'old');
});


test('historical metadata fallback and multi-list decline ranking stay deterministic', async () => {
  const original = globalThis.fetch;
  const names = allNames['25'];
  const manifests = allManifests as Record<string, ElectionManifest>;
  const manifest = manifests['25'];
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ voteData: votes({ a: 1 }) }));
    manifests['25'] = { phase: 'voting', lists: [] };
    await assert.rejects(() => loadComparisonElection('25', new AbortController().signal), /אין נתוני/);
    manifests['25'] = { phase: 'final', lists: [] };
    delete (allNames as Record<string, unknown>)['25'];
    assert.deepEqual((await loadComparisonElection('25', new AbortController().signal)).names, {});
  } finally {
    globalThis.fetch = original; allNames['25'] = names;
    if (manifest) manifests['25'] = manifest; else delete manifests['25'];
  }
  const declines = { ...context, votes: votes({ new: 100, other: 600, c: 200, d: 100 }) };
  assert.equal(answer('איזו רשימה ירדה הכי הרבה באחוזים', declines).rows.length, 2);
  const unnamed = { ...context, comparison: { ...old, names: {} } };
  assert.match(answer('בכמה אחוזים הרשימות הערביות עלו לעומת הבחירות הקודמות', unnamed).note, /a, b/);
});
