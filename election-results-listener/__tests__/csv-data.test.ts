import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCsvData, getCsvResults, fetchResultsCsv } from '../../dist/csv-data.js';
import config from '../config';
import { readFileSync } from 'node:fs';

test('configured CSV import excludes committee codes with and without a BOM', () => {
  for (const header of ['סמל ועדה', '\uFEFFסמל ועדה']) {
    for (const csv of [
      `${header},פסולים,מחל,אמת\n11893,3,10,2`,
      `סמל ישוב,${header},פסולים,מחל,אמת\n1,11893,3,10,2`,
    ]) {
      assert.deepEqual(getCsvResults(csv, config.notPartiesKeys), {
        voteData: { מחל: { votes: 10 }, אמת: { votes: 2 } }, countedVotes: 15,
      });
    }
  }
});

const metadata = ['סמל ישוב', 'כשרים'];
test('counted ballots include invalid votes from the same CSV, including a zero-invalid count', () => {
  for (const invalid of [0, 3]) {
    assert.deepEqual(getCsvResults(`סמל ישוב,פסולים,מחל,אמת\n1,${invalid},10,2\n2,1,3,5`, [...metadata, 'פסולים']), {
      voteData: { מחל: { votes: 13 }, אמת: { votes: 7 } }, countedVotes: 21 + invalid,
    });
  }
  assert.deepEqual(getCsvResults('סמל ישוב,מחל\n1,5', metadata), { voteData: { מחל: { votes: 5 } } });
});

test('rejects malformed invalid counts and unsafe combined totals', () => {
  for (const invalid of ['', '-1', '1.5', 'nope', '9007199254740992']) {
    assert.throws(() => getCsvResults(`סמל ישוב,פסולים,מחל\n1,${invalid},5`, [...metadata, 'פסולים']));
  }
  assert.throws(() => getCsvResults('סמל ישוב,פסולים,מחל\n1,9007199254740991,1\n2,1,1', [...metadata, 'פסולים']));
  assert.throws(() => getCsvResults('סמל ישוב,פסולים,מחל\n1,1,9007199254740991', [...metadata, 'פסולים']));
  assert.throws(() => getCsvResults('סמל ישוב,מחל,אמת\n1,9007199254740991,1', metadata));
});
test('aggregates a real CSV shape, skips metadata and handles BOM and blank lines', () => {
  assert.deepEqual(getCsvData('\uFEFFסמל ישוב,כשרים,מחל,אמת\n1,12,10,2\n\n2,8,3,5\n', metadata), {
    מחל: { votes: 13 }, אמת: { votes: 7 },
  });
});
test('ignores empty header columns without interpreting them as parties', () => {
  assert.deepEqual(getCsvData('סמל ישוב,,מחל\n1,,5', metadata), { מחל: { votes: 5 } });
});

test('rejects malformed source data before publication', () => {
  for (const csv of ['', 'סמל ישוב,מחל,מחל\n1,2,3',
    '<html>error</html>\nerror', 'סמל ישוב,כשרים\n1,10',
    'מחל,אמת\n2,3', 'סמל ישוב,מחל\n1,-1', 'סמל ישוב,מחל\n1,1.5',
    'סמל ישוב,מחל\n1,nope', 'סמל ישוב,מחל\n1,',
    'סמל ישוב,מחל\n1,9007199254740992',
    'סמל ישוב,מחל\n1,9007199254740991\n2,1', 'סמל ישוב,מחל\n1,2,3']) {
    assert.throws(() => getCsvData(csv, metadata), undefined, csv);
  }
});
test('fetches with a deadline and preserves the source timestamp', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://example.test/results.csv');
    assert.ok(options?.signal instanceof AbortSignal);
    return new Response('CSV', { headers: { 'last-modified': 'Wed, 14 Oct 2026 12:00:00 GMT' } });
  });
  assert.deepEqual(await fetchResultsCsv('https://example.test/results.csv'), {
    csv: 'CSV', time: '2026-10-14T12:00:00.000Z',
  });
});
test('rejects failed HTTP responses and network failures', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('error', { status: 503 }));
  await assert.rejects(fetchResultsCsv('url'), /HTTP 503/);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('network'); });
  await assert.rejects(fetchResultsCsv('url'), /network/);
});
test('uses a valid current timestamp when Last-Modified is absent or invalid', async (t) => {
  for (const headers of [{}, { 'last-modified': 'invalid' }]) {
    t.mock.method(globalThis, 'fetch', async () => new Response('CSV', { headers }));
    const before = Date.now();
    const result = await fetchResultsCsv('url');
    assert.ok(Date.parse(result.time) >= before && Date.parse(result.time) <= Date.now());
  }
});

test('accepts the official header-only preparation file with its trailing empty column', () => {
  const csv = readFileSync(new URL('./fixtures/elections-26-header.csv', import.meta.url), 'utf8');
  const results = getCsvResults(csv, config.notPartiesKeys);
  assert.equal(Object.keys(results.voteData).length, 38);
  assert.ok(Object.values(results.voteData).every(party => party.votes === 0));
  assert.equal(results.countedVotes, 0);
  assert.ok('צבי' in results.voteData && 'כן' in results.voteData);
  assert.ok(!('' in results.voteData));
});

test('accepts zero-filled rows and header-only files without invalid-ballot columns', () => {
  assert.deepEqual(getCsvResults('סמל ישוב,פסולים,מחל,אמת\n1,0,0,0', [...metadata, 'פסולים']), {
    voteData: { מחל: { votes: 0 }, אמת: { votes: 0 } }, countedVotes: 0,
  });
  assert.deepEqual(getCsvResults('סמל ישוב,מחל\n', metadata), { voteData: { מחל: { votes: 0 } } });
});

test('configured CSV import excludes external and other-ballot metadata from results and totals', () => {
  for (const values of ['0,0', '100,200', ',']) {
    assert.deepEqual(getCsvResults(`סמל ישוב,חיצוניות,קלפי אחרת,פסולים,מחל,אמת\n1,${values},3,10,2`, config.notPartiesKeys), {
      voteData: { מחל: { votes: 10 }, אמת: { votes: 2 } }, countedVotes: 15,
    });
  }
  assert.deepEqual(getCsvResults('סמל ישוב,חיצוניות,קלפי אחרת,פסולים,מחל\n', config.notPartiesKeys), {
    voteData: { מחל: { votes: 0 } }, countedVotes: 0,
  });
});
