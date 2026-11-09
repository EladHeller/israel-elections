import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import manifests from '../../dist/preview-runtime/elections-client/src/data/elections-manifests.json';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { createPreviewHandler, handler, previewHtml, readPreviewData } from '../../dist/preview-runtime/election-results-listener/question-preview.js';
const event = (q = 'כמה קולות קיבל הליכוד', election = '26', method = 'GET') => ({ rawPath: `/api/question-preview/v1/${election}`, rawQueryString: new URLSearchParams({ q }).toString(), requestContext: { http: { method } } });
const read = async (key: string) => readFileSync(key === 'election-config.json' ? 'elections-client/src/data/elections-config.json' : `elections-client/public/${key}`, 'utf8');
const preview = createPreviewHandler(read, 'https://dev.example.com');

test('answers national, scenario, geographic and comparison links using deployed data and the shared engine', async () => {
  for (const [question, expected] of [
    ['כמה קולות קיבל הליכוד', /1,167,591.*27 מנדטים/],
    ['מה היה קורה אם אחוז החסימה היה 1%', /מנדטים/],
    ['באיזה יישוב קיבל הליכוד הכי הרבה קולות', /קולות.*מהקולות הכשרים במקום/],
    ['באיזו קלפי קיבל הליכוד הכי הרבה קולות', /קולות.*מהקולות הכשרים במקום/],
    ['בכמה מנדטים עלתה הליכוד לעומת הבחירות הקודמות', /הליכוד/],
    ['כמה קולות חסרים לליכוד למנדט נוסף', /הייתה צריכה עוד/],
  ] as const) {
    const response = await preview(event(question));
    assert.equal(response.statusCode, 200, question);
    assert.match(response.body, expected, question);
    assert.match(response.body, /og:image.*https:\/\/dev.example.com\/social\/question-26-v2.png/);
    assert.match(response.headers['cache-control'], /s-maxage=86400/);
    assert.ok(!response.body.includes('elections-26-v2.png'));
    assert.ok(response.body.includes('/questions/26?q='));
  }
});

test('unsupported, unavailable and failed questions keep a question-only preview with short caching', async t => {
  t.mock.method(console, 'error', () => {});
  for (const create of [
    () => preview(event('ניסוח לא נתמך')),
    () => createPreviewHandler(async () => { throw new Error('offline'); }, 'https://dev.example.com')(event()),
    () => createPreviewHandler(async key => key === 'election-config.json' ? '{}' : read(key), 'https://dev.example.com')(event()),
    () => createPreviewHandler(async key => key === 'election-config.json' ? read(key) : '{"voteData":{"a":{"votes":-1}}}', 'https://dev.example.com')(event()),
    () => createPreviewHandler(async key => key === 'election-config.json' ? read(key) : '{"voteData":null}', 'https://dev.example.com')(event()),
    () => preview(event('באיזה יישוב קיבל הליכוד הכי הרבה קולות', '1')),
  ]) {
    const response = await create();
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /og:description" content=""/);
    assert.match(response.headers['cache-control'], /s-maxage=30/);
  }
});

test('validates paths, methods, duplicate questions, sizes, controls and HEAD without leaking data', async () => {
  const requests = [{}, event('', '0'), event('', '27'), event('', '26', 'POST')];
  for (const request of requests) assert.equal((await preview(request)).statusCode, 404);
  for (const q of ['', ' ', 'א'.repeat(601), 'a\u0000b', '\ufffd']) assert.equal((await preview(event(q))).statusCode, 400);
  assert.equal((await preview({ ...event(), rawQueryString: 'q=one&q=two' })).statusCode, 400);
  assert.equal((await preview({ ...event(), rawQueryString: '' })).statusCode, 400);
  const head = await preview(event(undefined, undefined, 'HEAD'));
  assert.equal(head.statusCode, 200); assert.equal(head.body, '');
  const html = previewHtml('https://dev.example.com', '26', '"<script>&\'', ['"<unsafe>&\'', 'א'.repeat(400)]);
  assert.ok(!html.includes('<script>')); assert.ok(html.includes('&quot;&lt;script&gt;&amp;&#39;'));
  assert.ok(html.includes('…')); assert.ok(html.includes('<p>&quot;&lt;unsafe&gt;&amp;&#39;</p>'));
});

test('reads only from the configured S3 bucket, falls back on missing bodies, and refreshes warm invocations', async t => {
  process.env.CLIENT_BUCKET = 'preview-dev'; process.env.SITE_URL = 'https://dev.example.com';
  const keys: string[] = [];
  t.mock.method(S3Client.prototype, 'send', async (command: GetObjectCommand) => {
    assert.equal(command.input.Bucket, 'preview-dev');
    keys.push(command.input.Key!);
    return { Body: { transformToString: () => read(command.input.Key!) } };
  });
  assert.equal((await handler(event())).statusCode, 200);
  await handler(event());
  assert.equal(keys.filter(key => key === 'data/26/allResults.json').length, 2);
  t.mock.restoreAll();
  t.mock.method(console, 'error', () => {});
  t.mock.method(S3Client.prototype, 'send', async () => ({}));
  const failed = await handler(event());
  assert.equal(failed.statusCode, 200); assert.match(failed.body, /og:description" content=""/);
});

test('S3 adapter rejects arbitrary bucket paths before making a request', async () => {
  for (const key of ['../secret', 'data/26/../secret', 'data/026/allResults.json', 'data/26/other.csv']) {
    await assert.rejects(readPreviewData(key, AbortSignal.timeout(100)), /Invalid data path/);
  }
});

test('counting answers have short TTL and pre-result phases return no answer', async () => {
  const original = manifests['26'].phase;
  try {
    manifests['26'].phase = 'counting';
    assert.match((await preview(event())).headers['cache-control'], /s-maxage=30/);
    manifests['26'].phase = 'voting';
    assert.match((await preview(event())).body, /og:description" content=""/);
  } finally { manifests['26'].phase = original; }
});
