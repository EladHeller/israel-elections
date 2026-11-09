import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('compiled preview answers a polling-station question with Lambda ESM features disabled', () => {
  const script = `
    const { readFileSync } = require('node:fs');
    const { createPreviewHandler } = require('./dist/preview-runtime/election-results-listener/question-preview.js');
    const read = async key => readFileSync(key === 'election-config.json'
      ? 'elections-client/src/data/elections-config.json' : 'elections-client/public/' + key, 'utf8');
    const handler = createPreviewHandler(read, 'https://example.com');
    handler({ rawPath: '/api/question-preview/v1/26',
      rawQueryString: new URLSearchParams({ q: 'באיזו קלפי ישר קיבלה הכי הרבה קולות?' }).toString(),
      requestContext: { http: { method: 'GET' } } }).then(response => {
        if (response.statusCode !== 200 || !/og:description" content="[^"]+קולות/.test(response.body)) process.exitCode = 1;
        console.log(JSON.stringify({ statusCode: response.statusCode, body: response.body }));
      }).catch(error => { console.error(error); process.exitCode = 1; });
  `;
  const result = spawnSync(process.execPath, ['--no-experimental-require-module', '--no-experimental-detect-module', '-e', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /קולות/);
  assert.ok(!result.stderr.includes('ERR_REQUIRE_ESM'));
});

test('runtime preparation rejects unexpected imports and only adapts the server build', async t => {
  const { mkdtemp, mkdir, writeFile, readFile, rm, copyFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'preview-csv-runtime-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const output = join(dir, 'dist/preview-runtime/elections-client/src/lib');
  await mkdir(output, { recursive: true });
  const path = join(output, 'party-research.js');
  const prepare = resolve('scripts/prepare-preview-runtime.cjs');
  const font = join(dir, 'elections-client/scripts/fonts');
  await mkdir(font, { recursive: true });
  await copyFile(resolve('elections-client/scripts/fonts/PreviewSans.ttf'), join(font, 'PreviewSans.ttf'));
  for (const source of ['', 'const first = require("csv-parse/browser/esm/sync"); const second = require("csv-parse/browser/esm/sync");']) {
    await writeFile(path, source);
    const result = spawnSync(process.execPath, [prepare], { cwd: dir, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Expected exactly one browser CSV import/);
    assert.equal(await readFile(path, 'utf8'), source);
  }
  await writeFile(path, 'const csv = require("csv-parse/browser/esm/sync");');
  assert.equal(spawnSync(process.execPath, [prepare], { cwd: dir }).status, 0);
  assert.equal(await readFile(path, 'utf8'), 'const csv = require("csv-parse/sync");');
  assert.deepEqual(await readFile(join(dir, 'dist/preview-runtime/preview-runtime/PreviewSans.ttf')), await readFile(join(font, 'PreviewSans.ttf')));
});
