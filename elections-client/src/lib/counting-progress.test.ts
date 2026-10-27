import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CountingProgress from '../components/CountingProgress';
import ResultsUpdate from '../components/ResultsUpdate';
import ElectionStatsSection from '../components/ElectionStatsSection';
import { fetchCountingEstimate, getCountingProgress } from './counting-progress';
import type { ElectionResultsPayload } from '../types';

const results = (valid: number, countedVotes?: number): ElectionResultsPayload => ({
  voteData: { a: { votes: valid, mandats: 120 } }, realResults: {}, countedVotes,
});
const render = (valid: number, counted: number | undefined, totalVotes?: number, isDemo = false) =>
  renderToStaticMarkup(createElement(CountingProgress, { results: results(valid, counted), totalVotes, isDemo }));

test('computes counted percentage including invalid ballots and detects the strict 5% boundary', () => {
  assert.deepEqual(getCountingProgress(results(48, 49), 1000), {
    countedVotes: 49, percentage: 4.9, estimateExceeded: false, isEarly: true, includesInvalid: true, invalidVotes: 1,
  });
  assert.equal(getCountingProgress(results(49, 50), 1000).isEarly, false);
  assert.equal(getCountingProgress(results(51, 51), 1000).isEarly, false);
  assert.equal(getCountingProgress(results(0, 0), 1000).percentage, 0);
  assert.equal(getCountingProgress(results(1000, 1000), 1000).percentage, 100);
});

test('handles missing totals and older snapshots without treating uncounted ballots as invalid', () => {
  for (const total of [undefined, 0, -1, NaN, Infinity, 100.5]) {
    assert.equal(getCountingProgress(results(20), total).percentage, null);
  }
  for (const counted of [undefined, -1, NaN, Infinity, 1.5, 19]) {
    const progress = getCountingProgress(results(20, counted), 1000);
    assert.equal(progress.countedVotes, 20);
    assert.equal(progress.includesInvalid, false);
    assert.equal(progress.invalidVotes, undefined);
  }
  assert.equal(getCountingProgress(results(20, 21), 20).estimateExceeded, true);
  assert.equal(getCountingProgress(results(20, 21), 20).percentage, null);
});

test('renders the prominent count, accessible progress and early warning', () => {
  const early = render(150000, 160000, 5000000);
  assert.match(early, /כ־3.2%/);
  assert.match(early, /value="3.2"/);
  assert.match(early, /160,000/);
  assert.match(early, /5,000,000/);
  assert.match(early, /מתוך <bdi>5,000,000<\/bdi> מצביעים/);
  assert.doesNotMatch(early, /אומדן|אמדן/);
  assert.match(early, /הספירה בראשיתה/);
  assert.match(early, /counting-progress-warning/);
  assert.match(render(0, 0, 1000), /value="0"/);
  assert.match(render(1, 1, 10000), /פחות מ־0.1%/);
  assert.match(render(49999, 49999, 1000000), /כ־4.9%/);
  assert.match(render(99999, 99999, 100000), /כ־99.9%/);
  assert.match(render(100, 100, 100), /כ־100%/);
});

test('keeps the partial-results notice above the early threshold and labels demo data', () => {
  const html = render(49, 50, 1000, true);
  assert.match(html, /כ־5%/);
  assert.match(html, /נתוני דמה/);
  assert.match(html, /התקדמות הספירה בדמו/);
  assert.match(html, /אינן בהכרח מייצגות/);
  assert.doesNotMatch(html, /הספירה בראשיתה|counting-progress-warning/);
});

test('removes the representativeness warning strictly above 50% and changes the notice strictly above 99%', () => {
  for (const counted of [50000, 50001, 99000, 99001, 100000]) {
    const html = render(counted, counted, 100000);
    if (counted <= 50000) {
      assert.match(html, /הקלפיות שנספרו אינן בהכרח מייצגות את כלל המצביעים/);
    } else {
      assert.doesNotMatch(html, /הקלפיות שנספרו אינן בהכרח מייצגות את כלל המצביעים/);
    }
    if (counted > 99000) {
      assert.match(html, /התוצאות אינן סופיות עדיין/);
      assert.doesNotMatch(html, /התוצאות חלקיות/);
    } else {
      assert.match(html, /התוצאות חלקיות/);
      assert.doesNotMatch(html, /התוצאות אינן סופיות עדיין/);
    }
  }
});

test('explains unavailable estimates and legacy valid-only counts without a misleading progress bar', () => {
  const missing = render(20, undefined);
  assert.match(missing, /קולות כשרים נספרו/);
  assert.match(missing, /קולות פסולים אינם כלולים/);
  assert.match(missing, /כשיהיה זמין מספר המצביעים/);
  assert.doesNotMatch(missing, /<progress/);
  const exceeded = render(20, 21, 20);
  assert.match(exceeded, /גבוה ממספר המצביעים/);
  assert.doesNotMatch(exceeded, /<progress|כ־100%/);
  assert.match(render(20, undefined, 1000), /כ־2%/);
});

test('loads manual totalVotes changes even when the results snapshot has not changed', async t => {
  let totalVotes = 1000;
  t.mock.method(globalThis, 'fetch', async (url: string, options?: RequestInit) => {
    assert.equal(url, '/election-config.json');
    assert.equal(options?.cache, 'no-store');
    assert.ok(options?.signal instanceof AbortSignal);
    return Response.json({ '26': { totalVotes } });
  });
  const snapshot = results(49, 50);
  assert.equal(getCountingProgress(snapshot, (await fetchCountingEstimate('26')).totalVotes).percentage, 5);
  totalVotes = 2000;
  assert.equal(getCountingProgress(snapshot, (await fetchCountingEstimate('26')).totalVotes).percentage, 2.5);
});

test('allows an estimate to be removed or set to zero and rejects corrupt or unavailable config', async t => {
  for (const config of [{}, { totalVotes: 0 }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ '26': config }));
    assert.deepEqual(await fetchCountingEstimate('26'), { totalVotes: config.totalVotes });
  }
  for (const config of [null, 'bad', { totalVotes: -1 }, { totalVotes: 2.5 }, { totalVotes: '1000' }, { totalVotes: null }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ '26': config }));
    await assert.rejects(fetchCountingEstimate('26'));
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  await assert.rejects(fetchCountingEstimate('26'), /Failed to load/);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('network'); });
  await assert.rejects(fetchCountingEstimate('26'), /network/);
  t.mock.method(globalThis, 'fetch', async () => new Response('not JSON'));
  await assert.rejects(fetchCountingEstimate('26'));
});

test('statistics use counted ballots for invalid percentages and preserve historical statistics', () => {
  const renderStats = (props: Partial<Parameters<typeof ElectionStatsSection>[0]>) => renderToStaticMarkup(createElement(ElectionStatsSection, {
    validVotes: 49, isSimulator: false, ...props,
  }));
  const partial = renderStats({ isCounting: true, countedVotes: 50, totalVotes: 1000, invalidVotes: 1 });
  assert.match(partial, /2.00%/);
  assert.match(partial, /1,000<\/bdi> מצביעים/);
  assert.doesNotMatch(partial, /אומדן|אמדן/);
  assert.match(partial, /קולות פסולים שנספרו/);
  assert.doesNotMatch(renderStats({ isCounting: true, totalVotes: 1000 }), /95.10%/);
  assert.match(renderStats({ totalVotes: 50, invalidVotes: 1, turnoutPercentage: 65 }), /65.00%/);
  assert.match(renderStats({ totalVotes: 50, invalidVotes: 1, isDemo: true }), /הצבעה בדמו/);
  assert.match(renderStats({ isSimulator: true }), /הצבעה בפועל/);
});


test('explains waiting for first results regardless of the turnout estimate', () => {
  for (const totalVotes of [undefined, 0, 1000]) {
    const html = render(0, undefined, totalVotes);
    assert.match(html, /ממתינים לתוצאות הראשונות/);
    assert.match(html, /עדיין לא התקבלו תוצאות אמת/);
    assert.match(html, /אוטומטית עם הגעתן/);
    assert.doesNotMatch(html, /הספירה בעיצומה|הספירה בראשיתה|התוצאות חלקיות/);
  }
  assert.match(render(1, 1), /הספירה בעיצומה/);
  assert.doesNotMatch(render(1, 1), /ממתינים לתוצאות/);
  assert.doesNotMatch(render(0, 1), /ממתינים לתוצאות/);
});

test('zero snapshots do not announce a live update or unchanged seats', () => {
  const current = { ...results(0, 0), time: '2026-10-18T12:00:00Z' };
  for (const previous of [null, current]) {
    const html = renderToStaticMarkup(createElement(ResultsUpdate, {
      current, previous, blockPercentage: 0.0325, getPartyName: party => party,
    }));
    assert.match(html, /עדיין לא התקבלו תוצאות אמת/);
    assert.doesNotMatch(html, /ללא שינוי|בעדכון האחרון|נתונים מ־|בספירה/);
  }
});

test('announces arriving results and subsequent changes after waiting ends', () => {
  const snapshot = (votes: number[], seats: number[]) => ({
    voteData: Object.fromEntries(votes.map((votes, i) => [String(i), { votes, mandats: seats[i] }])),
    realResults: Object.fromEntries(votes.map((votes, i) => [String(i), { votes, mandats: seats[i] }])),
    time: '2026-10-18T12:00:00Z',
  });
  const renderUpdate = (current: ElectionResultsPayload, previous: ElectionResultsPayload | null, isDemo = false, blockPercentage = 0) =>
    renderToStaticMarkup(createElement(ResultsUpdate, { current, previous, isDemo, blockPercentage, getPartyName: party => `Party${party}` }));
  const previous = snapshot([50, 30, 20, 10], [50, 30, 20, 20]);
  assert.match(renderUpdate(previous, null), /התוצאות מתעדכנות אוטומטית/);
  assert.match(renderUpdate(previous, previous), /ללא שינוי בחלוקת המנדטים/);
  assert.match(renderUpdate(previous, previous), /נתונים מ־/);
  assert.match(renderUpdate(previous, previous, true), /מידע דמה|בדוגמה הזו/);
  const next = snapshot([50, 30, 20, 10], [49, 31, 21, 19]);
  const changed = renderUpdate(next, previous);
  assert.match(changed, /עלתה ל־|ירדה ל־/);
  assert.match(changed, /עוד 2 שינויים/);
  assert.match(renderUpdate(snapshot([50, 30, 20], [49, 31, 21]), snapshot([50, 30, 20], [50, 30, 20])), /שינוי נוסף/);
  const crossed = renderUpdate(snapshot([90, 0, 10], [100, 0, 20]), snapshot([90, 10, 0], [100, 20, 0]), false, 0.05);
  assert.match(crossed, /עברה את אחוז החסימה/);
  assert.match(crossed, /ירדה מתחת לאחוז החסימה/);
  assert.doesNotMatch(changed, /ממתינים לתוצאות|עדיין לא התקבלו/);
});

