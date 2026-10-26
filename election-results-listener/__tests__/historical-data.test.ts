import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const dataDirectory = new URL('../../elections-client/public/data/', import.meta.url);

test('published election results do not include committee metadata as a party', () => {
  for (const election of readdirSync(dataDirectory)) {
    const results = JSON.parse(readFileSync(new URL(`${election}/allResults.json`, dataDirectory), 'utf8'));
    for (const section of ['voteData', 'realResults', 'withoutAgreements', 'beforeBaderOffer']) {
      assert.ok(!Object.keys(results[section] ?? {}).some(key => key.trim() === 'סמל ועדה'),
        `Election ${election}: committee metadata in ${section}`);
    }
  }
});

test('corrected historical votes exclude committee codes and preserve unrepresented votes', () => {
  for (const [election, validVotes, unrepresentedVotes] of [
    [22, 4436806, 126704],
    [23, 4590062, 36901],
    [24, 4410052, 64752],
  ]) {
    const results = JSON.parse(readFileSync(new URL(`${election}/allResults.json`, dataDirectory), 'utf8'));
    const parties = Object.entries(results.voteData) as [string, { votes: number }][];
    assert.equal(parties.reduce((sum, [, { votes }]) => sum + votes, 0), validVotes);
    assert.equal(parties.filter(([key]) => !results.realResults[key]?.mandats)
      .reduce((sum, [, { votes }]) => sum + votes, 0), unrepresentedVotes);
  }
});

test('first Knesset ballot symbols identify the correct lists, votes and seats', () => {
  // Names and elected lists: https://he.wikipedia.org/wiki/הבחירות_לאספה_המכוננת
  // Retain the existing minor-list vote counts, also published by IDI:
  // https://www.idi.org.il/policy/parties-and-elections/elections/1949/
  const names = JSON.parse(readFileSync(new URL('../../elections-client/src/data/party-names.json', import.meta.url), 'utf8'))['1'];
  const results = JSON.parse(readFileSync(new URL('1/allResults.json', dataDirectory), 'utf8'));
  const expected: [string, string, number, number][] = [
    ['א', 'מפא"י', 155274, 46],
    ['מ', 'מפ"ם', 64018, 19],
    ['ב', 'החזית הדתית המאוחדת', 52982, 16],
    ['ח', 'חרות', 49782, 14],
    ['צ', 'הציונים הכלליים', 22661, 7],
    ['פ', 'המפלגה הפרוגרסיבית', 17786, 5],
    ['ס', 'ספרדים ועדות המזרח', 15287, 4],
    ['ק', 'מק"י', 15148, 4],
    ['יד', 'הרשימה הדמוקרטית של נצרת', 7387, 2],
    ['טו', 'רשימת הלוחמים', 5363, 1],
    ['נ', 'ויצו', 5173, 1],
    ['ל', 'התאחדות התימנים בישראל', 4399, 1],
    ['יא', 'הגוש העובד', 3205, 0],
    ['ג', 'תנועת ז׳בוטינסקי – ברית הצה״ר', 2892, 0],
    ['יח', 'רשימת חרדים', 2835, 0],
    ['ת', 'הגוש העממי הערבי', 2812, 0],
    ['פד', 'הפועלת והאישה הדתית', 2796, 0],
    ['יג', 'רשימת יצחק גרינבוים', 2514, 0],
    ['ש', 'הרשימה המאוחדת של פועלים דתיים', 1280, 0],
    ['ט', 'למען ירושלים', 842, 0],
    ['יט', 'רשימת היהדות המסורתית', 241, 0],
  ];
  assert.deepEqual(Object.keys(names).sort(), expected.map(([symbol]) => symbol).sort());
  assert.deepEqual(Object.keys(results.voteData).sort(), Object.keys(names).sort());
  for (const [symbol, name, votes, seats] of expected) {
    assert.equal(names[symbol], name, symbol);
    assert.equal(results.voteData[symbol].votes, votes, name);
    assert.equal(results.realResults[symbol]?.mandats ?? 0, seats, name);
    if (seats) assert.equal(results.realResults[symbol].votes, votes, name);
  }
  assert.equal(Object.values(results.realResults).reduce((sum: number, row: { mandats: number }) => sum + row.mandats, 0), 120);
});
