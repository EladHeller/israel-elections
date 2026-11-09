import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { Resvg } from '@resvg/resvg-js';
import { createPreviewHandler } from '../../dist/preview-runtime/election-results-listener/question-preview.js';
import { answerImageSvg, answerImagePng, wrapText, textWidth } from '../../dist/preview-runtime/preview-runtime/answer-image.js';
const read = async (key: string) => readFileSync(key === 'election-config.json' ? 'elections-client/src/data/elections-config.json' : `elections-client/public/${key}`, 'utf8');
const event = (q: string, image = false, method = 'GET') => ({ rawPath: `/api/question-preview/v1/26${image ? '/image' : ''}`, rawQueryString: new URLSearchParams({ q }).toString(), requestContext: { http: { method } } });
const preview = createPreviewHandler(read, 'https://dev.example.com');

test('five-percent no-change answer is explicit in metadata and the image, without engine notes', async () => {
  const question = 'מה היה קורה אם אחוז החסימה היה 5%?';
  const html = await preview(event(question));
  assert.match(html.body, /og:description" content="חלוקת המנדטים נשארת ללא שינוי\."/);
  assert.ok(!html.body.includes('לא תחזית')); assert.ok(!html.body.includes('תרחיש מחושב'));
  const imageUrl = /property="og:image" content="([^"]+)"/.exec(html.body)![1];
  const url = new URL(imageUrl.replaceAll('&amp;', '&'));
  assert.equal(url.pathname, '/api/question-preview/v1/26/image');
  assert.equal(url.searchParams.get('q'), question);
  const png = await preview({ rawPath: url.pathname, rawQueryString: url.search.slice(1), requestContext: { http: { method: 'GET' } } });
  assert.equal(png.statusCode, 200); assert.equal(png.isBase64Encoded, true);
  assert.equal(png.headers['content-type'], 'image/png');
  const buffer = Buffer.from(png.body, 'base64');
  assert.equal(buffer.subarray(1, 4).toString(), 'PNG');
  assert.equal(buffer.readUInt32BE(16), 1200); assert.equal(buffer.readUInt32BE(20), 630);
  assert.equal(png.headers['cache-control'], html.headers['cache-control']);
  const svg = answerImageSvg('26', question, ['חלוקת המנדטים נשארת ללא שינוי.']);
  assert.match(svg, /חלוקת המנדטים נשארת/); assert.match(svg, /ללא שינוי/);
});

test('geographic metadata contains the result alone and image HEAD does not render a body', async () => {
  const question = 'באיזו קלפי ישר קיבלה הכי הרבה קולות?';
  const html = await preview(event(question));
  assert.match(html.body, /עספיא — קלפי 9: 424 קולות, שהם 75.58% מהקולות הכשרים במקום\./);
  assert.ok(!html.body.includes('אין סינון')); assert.ok(!html.body.includes('מקומות ללא קולות'));
  const head = await preview(event(question, true, 'HEAD'));
  assert.equal(head.statusCode, 200); assert.equal(head.body, ''); assert.equal(head.headers['content-type'], 'image/png');
});

test('unsupported questions use question-only images, and renderer failures redirect to the neutral election image', async t => {
  const response = await preview(event('ניסוח לא נתמך', true));
  assert.equal(response.statusCode, 200); assert.match(response.headers['cache-control'], /s-maxage=30/);
  assert.ok(!answerImageSvg('26', 'ניסוח לא נתמך', []).includes('fill="#f6aa1c">'));
  t.mock.method(Resvg.prototype, 'render', () => { throw new Error('render failed'); });
  t.mock.method(console, 'error', () => {});
  const failure = await preview(event('כמה קולות קיבל הליכוד', true));
  assert.equal(failure.statusCode, 302); assert.equal(failure.headers.location, 'https://dev.example.com/social/question-26-v2.png');
});

test('SVG escapes content and text fitting bounds long questions, answers and unbroken tokens', () => {
  assert.equal(textWidth('', 48), 0);
  assert.deepEqual(wrapText('   ', 48, 1000, 2), []);
  assert.deepEqual(wrapText('מילה', 48, 1000, 2), ['מילה']);
  for (const text of ['שאלה ארוכה '.repeat(100), 'W'.repeat(600)]) {
    const lines = wrapText(text, 60, 1000, 3);
    assert.ok(lines.length <= 3); assert.ok(lines.some((line: string) => line.endsWith('…')));
    for (const line of lines) assert.ok(textWidth(line, 60) <= 1000);
  }
  const svg = answerImageSvg('26', '<script>&"\'', ['<unsafe>&"\'']);
  assert.ok(!svg.includes('<script>')); assert.ok(svg.includes('&lt;script&gt;&amp;&quot;&apos;'));
  assert.ok(!svg.includes('<unsafe>')); assert.ok(answerImagePng('26', 'שאלה', ['תשובה']).length > 1000);
});

test('packaged renderer and font run with Lambda disabled ESM features', () => {
  const result = spawnSync(process.execPath, ['--no-experimental-require-module', '--no-experimental-detect-module', '-e', `const {answerImagePng}=require('./dist/preview-runtime/preview-runtime/answer-image.js'); const png=answerImagePng('26','מה היה קורה אם אחוז החסימה היה 5%?',['חלוקת המנדטים נשארת ללא שינוי.']); if(png.subarray(1,4).toString()!=='PNG')process.exitCode=1;`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
