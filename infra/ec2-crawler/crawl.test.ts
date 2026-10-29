import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';

const source = readFileSync('infra/ec2-crawler/crawl.mjs', 'utf8').replace(/^import .*;\n/gm, '');
const official = readFileSync('elections-client/src/lib/fixtures/election26-polling-stations.csv', 'utf8');

for (const alias of ['קלפי', 'מספר קלפי', 'סמל קלפי', 'missing']) test(`crawler validates a real station CSV shape (${alias})`, async () => {
  const csv = official.replace(',קלפי,', `,${alias},`);
  const bytes = Buffer.from(csv);
  const output: string[] = [];
  const errors: string[] = [];
  let disconnected = false;
  const page = { url: () => 'https://votes26.bechirot.gov.il/', reload: async () => {}, locator: selector => { assert.equal(selector, '#DownloadCSVBallots'); return { waitFor: async () => {}, isVisible: async () => true }; }, screenshot: async () => { throw new Error('Diagnostic screenshots must not block polling'); } };
  const download = { saveAs: async () => {}, url: () => 'https://media26.bechirot.gov.il/files/expb.csv' };
  const process = { argv: ['node', 'crawl.mjs', 'polling-stations'], exitCode: 0 };
  await runInNewContext(`(async () => {${source}})()`, {
    chromium: { connectOverCDP: async () => ({ contexts: () => [{ pages: () => [page] }], close: async () => { disconnected = true; } }) },
    downloadPollingStations: async () => download, downloadCities: async () => { throw new Error('Wrong dataset'); },
    parse, readFile: async () => bytes, stat: async () => ({ size: bytes.length }), mkdir: async () => {}, createHash,
    TextDecoder, process, console: { log: value => output.push(value), error: value => errors.push(value) },
  });
  assert.equal(disconnected, true);
  if (alias === 'missing') {
    assert.equal(process.exitCode, 1);
    assert.match(errors[0], /not a valid results CSV/);
    assert.equal(output.length, 0);
  } else {
    const result = JSON.parse(output[0]);
    assert.equal(process.exitCode, 0);
    assert.equal(result.ok, true);
    assert.equal(result.rows, 4);
    assert.equal(result.source, download.url());
    assert.match(result.path, /polling-stations-/);
  }
});
