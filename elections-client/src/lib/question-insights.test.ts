import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeElectionQuestion as execute, parseElectionQuestion as parse, type QuestionContext } from './election-questions';
import { insightNeedsPlaces, parseInsight, type InsightMetric, type InsightQuery } from './question-insights';
import { parseLocalities, parsePollingStations, type LocalityVotes } from './party-research';
import { computeScenarioResults } from './scenario';

const context: QuestionContext = { votes: { א: { votes: 600, mandats: 0 }, ב: { votes: 300, mandats: 0 }, ג: { votes: 100, mandats: 0 } }, names: { א: 'הליכוד', ב: 'הציונות הדתית', ג: 'עמך ישראל' }, config: { blockPercentage: 0.2, agreements: [['א', 'ב']], algorithm: 'baderOffer' } };
const place = (id: string, votes: Record<string, number>, extra: Partial<LocalityVotes> = {}): LocalityVotes => ({ id, name: `מקום ${id}`, votes, validVotes: Object.values(votes).reduce((sum, value) => sum + value, 0), ...extra });
const q = (metric: InsightMetric, options: Partial<InsightQuery> = {}): InsightQuery => ({ kind: 'insight', metric, level: 'localities', limit: 10, minimum: 100, byVotes: false, ...options });
const ask = (text: string) => { const result = parse(text, context); assert.ok('query' in result, `${text}: ${JSON.stringify(result)}`); return result.query; };
const prose = (metric: InsightMetric, places?: LocalityVotes[], options: Partial<InsightQuery> = {}, ctx = context) => execute(q(metric, options), ctx, places).rows.map(row => row[0]).join('\n');

test('insight grammar supports Hebrew variants, list prefixes, bounded limits and minimum sizes without accepting extra clauses', () => {
  const families: [string, InsightMetric][] = [['היה הקרב הכי צמוד', 'closest'], ['היה הכי צמוד', 'closest'], ['הפער בין שתי המובילות היה הכי קטן', 'closest'], ['הצביעו הכי דומה לתוצאה הארצית', 'similarity'], ['הצביעו הכי דומה למדינה', 'similarity'], ['הצביעו הכי דומה לתוצאות הארציות', 'similarity'], ['שיעור ההצבעה היה הכי גבוה', 'turnout-high'], ['אחוז ההצבעה היה הכי נמוך', 'turnout-low']];
  for (const unit of ['יישובים', 'ישובים', 'יישוב', 'ישוב', 'קלפיות', 'קלפי']) for (const [suffix, metric] of families) {
    assert.deepEqual(ask(`באילו ${unit} ${suffix}?`), q(metric, { level: unit.startsWith('קלפ') ? 'stations' : 'localities' }));
    assert.deepEqual(ask(`איזה 3 ${unit} ${suffix} עם לפחות 50 קולות כשרים`), q(metric, { level: unit.startsWith('קלפ') ? 'stations' : 'localities', limit: 3, minimum: 50 }));
  }
  assert.deepEqual(ask('איפה היה הכי צמוד בקולות עם לפחות 0 קולות כשרים'), q('closest', { byVotes: true, minimum: 0 }));
  assert.deepEqual(ask('איפה היה הכי צמוד באחוזים'), q('closest'));
  assert.deepEqual(ask('מי ניצחה ביישוב עיר לדוגמה ובכמה קולות'), q('winner', { place: 'עיר לדוגמה', minimum: 0, station: undefined }));
  assert.deepEqual(ask('מי ניצח בעיר לדוגמה בקלפי 01.1'), q('winner', { place: 'עיר לדוגמה', station: '01.1', level: 'stations', minimum: 0 }));
  assert.equal((ask('מי קיבלה הכי הרבה קולות בישוב עיר לדוגמה') as InsightQuery).metric, 'winner');
  for (const text of ['כמה קולות לא עברו את אחוז החסימה', 'כמה קולות הלכו לרשימות שלא עברו את אחוז החסימה', 'כמה קולות התבזבזו']) assert.deepEqual(ask(text), q('wasted'));
  for (const wording of ['הייתה עוברת', 'היתה עוברת', 'עברה']) assert.deepEqual(ask(`מה היה קורה אם עמך ישראל ${wording} את אחוז החסימה`), q('threshold-entry', { party: 'ג' }));
  assert.deepEqual(ask('מה אילו עמך ישראל עברה את אחוז החסימה'), q('threshold-entry', { party: 'ג' }));
  assert.deepEqual(ask('בכמה יישובים הליכוד קיבלה קולות'), q('coverage', { party: 'א' }));
  assert.deepEqual(ask('בכמה ישובים הליכוד קבלה קולות'), q('coverage', { party: 'א' }));
  for (const [verb, metric] of [['התחזקה', 'strengthened'], ['התחזק', 'strengthened'], ['נחלשה', 'weakened'], ['נחלש', 'weakened']] as const) {
    for (const suffix of ['', ' באחוזים', ' בקולות']) assert.deepEqual(ask(`באילו יישובים הליכוד ${verb} הכי הרבה מאז הבחירות הקודמות${suffix}`), q(metric, { party: 'א', byVotes: suffix === ' בקולות' }));
  }
  for (const text of ['באילו 0 יישובים היה הכי צמוד', 'באילו 101 קלפיות היה הכי צמוד', 'איפה היה הכי צמוד עם לפחות 999999999999999999 קולות כשרים', 'איפה היה הכי צמוד וגם בלי אחוז חסימה', 'איפה הצביעו הכי דומה למדינה בקולות', 'איפה שיעור ההצבעה היה הכי גבוה בקולות']) assert.ok('error' in parse(text, context), text);
  assert.equal(parseInsight('מי ניצחה ב@0', ['א']), null);
  assert.equal(parseInsight('מי ניצחה ב@0', []), null);
  assert.equal(insightNeedsPlaces(q('threshold-entry')), false);
  assert.equal(insightNeedsPlaces(q('wasted')), false);
  assert.equal(insightNeedsPlaces(q('closest')), true);
  assert.equal(insightNeedsPlaces({ kind: 'results', parties: [] }), false);
});

test('closest races rank by proportional margin or vote count, retain ties and splits, and exclude uncontested or small places', () => {
  const places = [place('b', { א: 50, ב: 50 }), place('a', { א: 50, ב: 50 }, { pollingStation: '1.1', split: 0 }), place('c', { א: 501, ב: 499 }), place('d', { א: 51, ב: 49 }), place('e', { א: 100 }), place('f', { א: 5, ב: 5 }), place('g', {}, { validVotes: 0 })];
  const before = structuredClone(places);
  let rows = execute(q('closest'), context, places).rows;
  assert.equal(rows.length, 4); assert.match(String(rows[0][0]), /מקום a — קלפי 1.1 \/ פיצול 0.*תיקו/);
  assert.match(String(rows[2][0]), /מקום c.*2 קולות.*0.2%/);
  assert.match(prose('closest', places, { byVotes: true }), /מספר|קולות/);
  rows = execute(q('closest', { limit: 1, minimum: 1000 }), context, places).rows;
  assert.equal(rows.length, 1); assert.match(String(rows[0][0]), /מקום c/);
  assert.equal(execute(q('closest'), context, []).rows.length, 0);
  assert.deepEqual(places, before);
});

test('similarity uses all national and local lists and total variation distance', () => {
  const places = [place('same', { א: 60, ב: 30, ג: 10 }), place('different', { א: 100 }), place('other', { אחר: 100 })];
  const rows = execute(q('similarity'), context, places).rows;
  assert.match(String(rows[0][0]), /מקום same.*100%/);
  assert.match(String(rows[1][0]), /מקום different.*60%/);
  assert.match(String(rows[2][0]), /מקום other.*0%/);
  const ties = execute(q('similarity'), context, [place('b', { א: 100 }), place('a', { א: 100 })]).rows;
  assert.match(String(ties[0][0]), /מקום a/);
});

test('turnout uses all voters including invalid ballots and excludes missing or contradictory metadata', () => {
  const places = [place('b', { א: 100 }, { eligibleVoters: 200, voters: 120 }), place('a', { א: 100 }, { eligibleVoters: 200, voters: 120 }), place('high', { א: 150 }, { eligibleVoters: 200, voters: 190 }), place('missing', { א: 100 }), ...[NaN, 0, -1, 1.5, Infinity].map((eligibleVoters, index) => place(`bad${index}`, { א: 100 }, { eligibleVoters, voters: 100 })), place('over', { א: 100 }, { eligibleVoters: 100, voters: 101 }), place('under', { א: 100 }, { eligibleVoters: 200, voters: 90 })];
  assert.match(String(execute(q('turnout-high'), context, places).rows[0][0]), /high.*95%.*190.*200/);
  assert.match(String(execute(q('turnout-low'), context, places).rows[0][0]), /מקום a.*60%/);
  assert.equal(execute(q('turnout-low'), context, places).rows.length, 3);
  assert.throws(() => execute(q('turnout-high'), context, [places[3]]), /בעלי זכות/);
  assert.equal(execute(q('turnout-high'), context, []).rows.length, 0);
});

test('turnout CSV metadata aggregates rows, accepts historical headers and preserves missing data instead of replacing it with zero', () => {
  for (const header of ['בזב', "בז''ב", 'בוחרים']) {
    const csv = `שם ישוב,סמל ישוב,מספר קלפי,${header},מצביעים,כשרים,א\nעיר,1,1,200,120,100,100\nעיר,1,2,300,200,190,190`;
    const localities = parseLocalities(csv); const stations = parsePollingStations(csv);
    assert.equal(localities[0].eligibleVoters, 500); assert.equal(localities[0].voters, 320);
    assert.equal(stations[0].eligibleVoters, 200); assert.equal(stations[1].voters, 200);
  }
  for (const value of ['', 'NaN', '-1', '1.5']) {
    const rows = parseLocalities(`שם ישוב,בזב,מצביעים,כשרים,א\nעיר,${value},${value},100,100\nעיר,200,120,100,100`);
    assert.ok(Number.isNaN(rows[0].eligibleVoters)); assert.ok(Number.isNaN(rows[0].voters));
    assert.throws(() => execute(q('turnout-high'), context, rows), /בעלי זכות/);
  }
});

test('winner questions distinguish locality names and station numbers, show ties and uncontested places, and reject ambiguity', () => {
  assert.match(prose('winner', [place('1', { א: 60, ב: 40 })], { place: 'מקום 1' }), /הליכוד.*60.*60%.*20 קולות/);
  assert.match(prose('winner', [place('1', { א: 50, ב: 50 }, { pollingStation: '1' })], { place: 'מקום 1', station: '01' }), /בתיקו.*אפס|בתיקו.*0 קולות/);
  assert.match(prose('winner', [place('1', { א: 100 }, { pollingStation: '1', split: 1 })], { place: 'מקום 1', station: '1' }), /פיצול 1.*100 קולות/);
  assert.match(prose('winner', [place('1', { א: 100 })], { place: 'מקום 1' }, { ...context, names: {} }), /א במקום הראשון/);
  assert.equal(execute(q('winner', { place: 'מקום 1' }), context, [place('1', {})]).rows.length, 0);
  assert.equal(execute(q('winner', { place: 'מקום 1' }), context, [place('1', { א: 1 }, { validVotes: 0 })]).rows.length, 0);
  assert.throws(() => execute(q('winner', { place: 'חסר' }), context, []), /לא נמצא/);
  assert.throws(() => execute(q('winner', { place: 'מקום 1' }), context, [place('1', { א: 100 }), place('1', { א: 200 })]), /חד משמעי/);
  assert.throws(() => execute(q('closest'), context), /אינם זמינים/);
});

test('national questions count only below-threshold valid votes and local support without a minimum filter', () => {
  assert.match(prose('wasted'), /100 קולות.*10%/);
  assert.match(prose('wasted', undefined, {}, { ...context, config: { ...context.config, blockPercentage: 0.1 } }), /0 קולות/);
  const places = [place('1', { א: 1 }), place('2', { ב: 10 }), place('3', { א: 100 })];
  assert.match(prose('coverage', places, { party: 'א' }), /2 מתוך 3/);
  assert.match(prose('coverage', [], { party: 'א' }), /0 מתוך 0/);
  assert.throws(() => execute(q('coverage', { party: 'missing' }), context, []), /קיימת/);
});

test('threshold-entry adds the minimum new votes, preserves other lists and uses the existing seat algorithm', () => {
  for (const algorithm of ['baderOffer', 'ceilRound'] as const) for (const agreements of [[], [['א', 'ב']]] as [string, string][][]) {
    const ctx = { ...context, config: { ...context.config, algorithm, agreements } };
    const before = structuredClone(ctx); const result = execute(q('threshold-entry', { party: 'ג' }), ctx);
    assert.match(String(result.rows[0][0]), /125 קולות חדשים/);
    assert.ok((100 + 125) / (1000 + 125) >= 0.2); assert.ok((100 + 124) / (1000 + 124) < 0.2);
    const changed = structuredClone(ctx.votes); changed['ג'].votes += 125;
    const old = computeScenarioResults(ctx.votes, ctx.config).realResults; const next = computeScenarioResults(changed, ctx.config).realResults;
    const deltas = result.rows.filter(row => typeof row[1] === 'number');
    assert.equal(deltas.reduce((sum, row) => sum + Number(row[1]), 0), 0);
    for (const id of Object.keys(ctx.votes)) if ((next[id]?.mandats ?? 0) !== (old[id]?.mandats ?? 0)) assert.ok(deltas.some(row => String(row[0]).startsWith(ctx.names[id]) && row[1] === (next[id]?.mandats ?? 0) - (old[id]?.mandats ?? 0)));
    assert.deepEqual(ctx, before);
  }
  for (const [total, current, threshold, expected] of [[44, 1, 0.14, 7], [1, 0, 0.8, 4]]) {
    const ctx = { ...context, votes: { א: { votes: total - current, mandats: 0 }, ג: { votes: current, mandats: 0 }, ב: { votes: 0, mandats: 0 } }, config: { ...context.config, blockPercentage: threshold } };
    assert.match(String(execute(q('threshold-entry', { party: 'ג' }), ctx).rows[0][0]), new RegExp(`${expected} קולות חדשים`));
  }
  const small = { ...context, votes: { א: { votes: 6000, mandats: 0 }, ב: { votes: 3000, mandats: 0 }, ג: { votes: 0, mandats: 0 } }, config: { ...context.config, blockPercentage: 0.000001 } };
  assert.match(prose('threshold-entry', undefined, { party: 'ג' }, small), /ללא שינוי/);
  assert.match(prose('threshold-entry', undefined, { party: 'א' }), /כבר מגיעה/);
  assert.throws(() => execute(q('threshold-entry', { party: 'ג' }), { ...context, config: { ...context.config, blockPercentage: 1 } }), /100%/);
});

test('previous-election comparisons use exact names and stable locality identity and distinguish votes from percentage points', () => {
  const places = [place('a', { א: 70, ב: 30 }), place('b', { א: 30, ב: 70 }), place('c', { א: 80, ב: 20 }), place('renamed', { א: 100 }), place('small', { א: 100 }), place('zero', { א: 100 }), place('same', { א: 100 }), place('missing-party', { ב: 100 }), place('absent', { א: 100 }), place('tie', { א: 70, ב: 30 }), place('fall', { א: 20, ב: 80 })];
  const previous = { id: '25', names: { ז: 'הליכוד' }, places: [place('a', { ז: 50, ב: 50 }), place('b', { ז: 50, ב: 50 }), place('c', { ז: 60, ב: 140 }), place('renamed', { ז: 10, ב: 90 }, { name: 'שם אחר' }), place('small', { ז: 1 }), place('zero', {}), place('same', { ז: 100 }), place('missing-party', { ב: 100 }), place('tie', { ז: 50, ב: 50 }), place('fall', { ז: 50, ב: 50 })] };
  const ctx = { ...context, previous }; const before = structuredClone(ctx);
  assert.match(String(execute(q('strengthened', { party: 'א' }), ctx, places).rows[0][0]), /מקום c.*50 נקודות אחוז/);
  assert.match(prose('weakened', places, { party: 'א' }, ctx), /מקום b.*20 נקודות אחוז/);
  assert.match(String(execute(q('strengthened', { party: 'א', byVotes: true }), ctx, places).rows[0][0]), /מקום a.*20 קולות/);
  assert.match(prose('weakened', places, { party: 'א', byVotes: true }, ctx), /20 קולות/);
  assert.match(execute(q('strengthened', { party: 'א' }), ctx, places).note, /25/);
  assert.equal(execute(q('strengthened', { party: 'א' }), ctx, places).rows.length, 3);
  assert.deepEqual(ctx, before);
  assert.throws(() => execute(q('strengthened', { party: 'א' }), context, places), /הקודמת/);
  for (const names of [{}, { ז: 'שם אחר' }, { ז: 'הליכוד', ח: 'הליכוד' }] as Record<string, string>[]) assert.throws(() => execute(q('strengthened', { party: 'א' }), { ...ctx, previous: { ...previous, names } }, places), /חד משמעית/);
});
