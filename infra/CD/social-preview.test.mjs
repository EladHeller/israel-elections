import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { electionPreviewAssets, electionPreviewSvg, renderPreview, previewRoot } from '../../elections-client/scripts/social-preview.mjs';

test('result images use real mandates, include third-place ties and omit superfluous text', () => {
  const lists = [{ name: 'א', seats: 60 }, { name: 'ב', seats: 30 }, { name: 'ג', seats: 10 }, { name: 'ד', seats: 10 }, { name: 'ה', seats: 10 }];
  const svg = electionPreviewSvg('1', lists);
  assert.equal((svg.match(/data-seats=/g) ?? []).length, 5);
  assert.ok(!svg.includes('הרשימות הגדולות')); assert.ok(!svg.includes('תוצאות מתעדכנות'));
  assert.match(svg, /הכנסת ה־1/);
  for (const list of lists) assert.ok(svg.includes(`data-list="${list.name}" data-seats="${list.seats}"`));
  assert.equal((electionPreviewSvg('26', [{ name: '<&"\'', seats: 120 }]).match(/data-list=/g) ?? []).length, 1);
  assert.ok(electionPreviewSvg('26', [{ name: '<&"\'', seats: 120 }]).includes('&lt;&amp;&quot;&apos;'));
  for (const [id, rows] of [['0', lists], ['26', []], ['26', [{ name: 'a', seats: 1 }]], ['26', [{ name: 'a', seats: -1 }]]]) assert.throws(() => electionPreviewSvg(id, rows));
  for (const length of [27, 37]) assert.match(electionPreviewSvg('26', [{ name: 'א'.repeat(length), seats: 120 }]), /data-seats="120"/);
});

test('question images contain no result bars or answer claims and render as 1200×630 PNGs', () => {
  const svg = electionPreviewSvg('26', [], 'question');
  assert.match(svg, /הכנסת ה־26/); assert.ok(!svg.includes('data-seats='));
  const png = renderPreview(svg);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1200); assert.equal(png.readUInt32BE(20), 630);
  const assets = electionPreviewAssets();
  assert.equal(assets.length, 52);
  assert.ok(assets.some(asset => asset.fileName === 'social/question-26-v2.png'));
  assert.ok(assets.some(asset => asset.fileName === 'social/elections-26-v2.png' && asset.svg.includes('data-seats="27"')));
});

test('build skips missing result files and uses ballot letters for unnamed lists', t => {
  const dir = mkdtempSync(`${tmpdir()}/social-preview-`);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(`${dir}/src/data`, { recursive: true }); mkdirSync(`${dir}/public/data/1`, { recursive: true });
  writeFileSync(`${dir}/src/data/party-names.json`, '{"1":{},"2":{}}');
  writeFileSync(`${dir}/public/data/1/allResults.json`, '{"realResults":{"א":{"mandats":120},"ב":{"mandats":0}}}');
  const assets = electionPreviewAssets(pathToFileURL(`${dir}/`));
  assert.equal(assets.length, 2); assert.match(assets[0].svg, /data-list="א"/);
});

test('build tools resolve bundled assets from both repository and client working directories', () => {
  const cwd = process.cwd();
  const expected = previewRoot().href;
  try {
    process.chdir('elections-client');
    assert.equal(previewRoot().href, expected);
    assert.ok(renderPreview(electionPreviewSvg('26', [], 'question')).length > 1000);
  } finally { process.chdir(cwd); }
});
