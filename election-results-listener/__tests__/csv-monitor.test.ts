import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const actualCsv = require('../../dist/csv-data.js');
const csv = 'סמל ישוב,פסולים,מחל,דרך\n1,4,100,50\n';

function listener(url: string | null = 'https://source.example/results.csv', sourceCsv = csv, canPublishEmpty = true) {
  const uploads: unknown[][] = [];
  const invalidations: unknown[][] = [];
  let exists = false;
  let matches = false;
  let matchChecks = 0;
  let emptyChecks = 0;
  const config = { currElections: 26, notPartiesKeys: ['סמל ישוב', 'פסולים'], distributionID: 'cdn',
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
