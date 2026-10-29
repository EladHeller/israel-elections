import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, mock } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const actualCsv = require('../../dist/csv-data.js');
const actualConfig = require('../../dist/config.js').default;
const csv = 'סמל ישוב,פסולים,מחל,דרך\n1,4,100,50\n';

function listener(url: string | null = 'https://source.example/results.csv', sourceCsv = csv, canPublishEmpty = true) {
  const uploads: unknown[][] = [];
  const invalidations: unknown[][] = [];
  let exists = false;
  let matches = false;
  let matchChecks = 0;
  let emptyChecks = 0;
  const config = { currElections: 26, notPartiesKeys: actualConfig.notPartiesKeys, distributionID: 'cdn',
    electionsConfig: { 26: { csvUrl: url, agreements: [], blockPercentage: 0.0325 } } };
  const load = Module._load;
  const stub = mock.method(Module, '_load', function (request, parent, isMain) {
    if (request === './config') return { __esModule: true, default: config };
    if (request === './s3') return { upload: async (...args) => uploads.push(args), isFileAlreadyExists: async () => exists };
    if (request === './cloudfront') return { invalidCache: async (...args) => invalidations.push(args) };
    if (request === './result-state') return { assertCanPublishEmptyResults: async (key) => {
      emptyChecks += 1;
      assert.equal(key, 'data/26/allResults.json');
      if (!canPublishEmpty) throw new Error('Empty results CSV cannot replace published votes');
    }, resultsMatch: async (_key, expected) => {
      matchChecks += 1;
      assert.equal(expected.countedVotes, 154);
      return matches;
    } };
    if (request === './csv-data') return { ...actualCsv, fetchResultsCsv: async () => ({ csv: sourceCsv, time: '2026-10-22T00:00:00.000Z' }) };
    return load.call(this, request, parent, isMain);
  });
  const path = require.resolve('../../dist/csv-monitor.js');
  delete require.cache[path];
  let api;
  try { api = require(path); } finally { stub.mock.restore(); }
  return { api, uploads, invalidations, setState: (csvExists: boolean, resultMatches: boolean) => { exists = csvExists; matches = resultMatches; }, get matchChecks() { return matchChecks; }, get emptyChecks() { return emptyChecks; } };
}

test('changed CSV publishes results and source, while unchanged valid data skips all writes', async () => {
  const state = listener();
  await state.api.csvMonitor();
  assert.equal(state.uploads.length, 4);
  assert.equal(state.invalidations.length, 2);
  assert.equal(state.matchChecks, 0);
  assert.equal(state.emptyChecks, 0);
  const result = JSON.parse(state.uploads[0][1] as string);
  assert.equal(result.countedVotes, 154);
  assert.equal(result.voteData['מחל'].votes, 100);
  assert.equal(state.uploads[2][0], 'data/26/elections.csv');
  state.setState(true, true);
  await state.api.csvMonitor();
  assert.equal(state.matchChecks, 1);
  assert.equal(state.uploads.length, 4);
});

test('unchanged CSV repairs reset or missing results without rewriting the processed CSV', async () => {
  const state = listener();
  state.setState(true, false);
  await state.api.csvMonitor();
  assert.equal(state.uploads.length, 2);
  assert.equal(state.invalidations.length, 1);
  assert.equal(state.uploads[0][0], 'data/26/allResults.json');
  assert.equal(JSON.parse(state.uploads[0][1] as string).countedVotes, 154);
  assert.equal(state.uploads[0][2], true);
  await state.api.uploadResults({ voteData: {} }, 25);
  assert.equal(state.uploads[2][2], false);
  assert.ok(Number.isFinite(Date.parse(JSON.parse(state.uploads[2][1] as string).time)));
});

test('published results use the actual update time instead of the source file time', async (t) => {
  const updatedAt = new Date('2026-10-22T00:10:00.000Z');
  t.mock.timers.enable({ apis: ['Date'], now: updatedAt });
  for (const csvExists of [false, true]) {
    const state = listener();
    state.setState(csvExists, false);
    await state.api.csvMonitor();
    const current = JSON.parse(state.uploads[0][1] as string);
    const archived = JSON.parse(state.uploads[1][1] as string);
    assert.equal(current.time, updatedAt.toISOString());
    assert.equal(archived.time, current.time);
    assert.equal(state.uploads[1][0], `data/26/${current.time}_allResults.json`);
    if (!csvExists) {
      assert.equal(state.uploads[3][0], 'data/26/2026-10-22T00:00:00.000Z_elections.csv');
    }
  }
});

test('no configured source fails explicitly before publishing any results', async () => {
  // The production pre-election configuration omits the URL entirely.
  const missing = listener(null);
  await assert.rejects(missing.api.csvMonitor(), /CSV url is missing/);
  assert.equal(missing.uploads.length, 0);
});

test('pre-election CSVs publish zero seats without activating any scheduler', async () => {
  for (const source of ['סמל ישוב,פסולים,מחל,דרך,\n', 'סמל ישוב,פסולים,מחל,דרך\n1,0,0,0', 'סמל ישוב,מחל,דרך']) {
    const state = listener(undefined, source);
    await state.api.csvMonitor();
    assert.equal(state.emptyChecks, 1);
    assert.equal(state.uploads.length, 4);
    const result = JSON.parse(state.uploads[0][1] as string);
    assert.deepEqual(result.voteData, { מחל: { votes: 0 }, דרך: { votes: 0 } });
    assert.deepEqual(result.realResults, {});
  }
});

test('empty snapshots cannot overwrite previously published votes or source files', async () => {
  for (const source of ['סמל ישוב,מחל,דרך', 'סמל ישוב,פסולים,מחל,דרך\n1,0,0,0']) {
    const state = listener(undefined, source, false);
    await assert.rejects(state.api.csvMonitor(), /cannot replace published votes/);
    assert.equal(state.uploads.length, 0);
    assert.equal(state.invalidations.length, 0);
  }
});

test('invalid-only first counts are published rather than mistaken for an empty snapshot', async () => {
  const state = listener(undefined, 'סמל ישוב,פסולים,מחל,דרך\n1,4,0,0');
  await state.api.csvMonitor();
  assert.equal(state.emptyChecks, 0);
  assert.equal(JSON.parse(state.uploads[0][1] as string).countedVotes, 4);
});

test('browser CSV uses the same validated publisher without fetching the HTTP source', async () => {
  const state = listener(null);
  await state.api.publishResultsCsv(csv, '2026-10-28T00:00:00.000Z');
  assert.equal(state.uploads.length, 4);
  assert.equal(JSON.parse(state.uploads[0][1] as string).countedVotes, 154);
  assert.equal(state.uploads[2][1], csv);
});

test('invalid browser CSV fails before publishing anything', async () => {
  const state = listener(null);
  await assert.rejects(state.api.publishResultsCsv('<html>Error</html>', '2026-10-28T00:00:00.000Z'));
  assert.equal(state.uploads.length, 0);
});

const stationsCsv = 'שם ישוב,סמל ישוב,מספר קלפי,כשרים,פסולים,מחל,דרך\nירושלים,3000,1,150,4,100,50\n';

test('station source is archived independently of unchanged city results without publishing seat totals', async () => {
  const state = listener();
  await state.api.publishPollingStationsCsv(stationsCsv, '2026-10-29T10:00:00.000Z');
  assert.deepEqual(state.uploads, [
    ['data/26/polling-stations.csv', stationsCsv, true],
    ['data/26/2026-10-29T10:00:00.000Z_polling-stations.csv', stationsCsv],
  ]);
  assert.deepEqual(state.invalidations, [[['data/26/polling-stations.csv'], 'cdn']]);
  assert.equal(state.matchChecks, 0);
  state.setState(true, true);
  await state.api.publishResultsCsv(csv, '2026-10-29T10:01:00.000Z');
  await state.api.publishPollingStationsCsv(stationsCsv, '2026-10-29T10:01:00.000Z');
  assert.equal(state.uploads.length, 2);
});

test('invalid and empty station downloads cannot overwrite published research data', async () => {
  for (const source of ['', csv, '<html>Denied</html>', stationsCsv.replace('100,50', '-1,50'), stationsCsv.split('\n')[0], stationsCsv.replace('150,4,100,50', '0,0,0,0')]) {
    const state = listener();
    await assert.rejects(state.api.publishPollingStationsCsv(source, '2026-10-29T10:00:00.000Z'));
    assert.equal(state.uploads.length, 0);
    assert.equal(state.invalidations.length, 0);
  }
});


test('publishes the official election 26 station format and retains older station header aliases', async () => {
  const official = readFileSync('elections-client/src/lib/fixtures/election26-polling-stations.csv', 'utf8');
  for (const alias of ['קלפי', 'מספר קלפי', 'סמל קלפי']) {
    const source = official.replace(',קלפי,', `,${alias},`);
    const state = listener();
    await state.api.publishPollingStationsCsv(source, '2026-10-29T14:00:00.000Z');
    assert.equal(state.uploads[0][0], 'data/26/polling-stations.csv');
    assert.equal(state.uploads[0][1], source);
    assert.equal(state.uploads.length, 2);
  }
});
