import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recordQuestion } from './question-log';
const attempt = { id: 'cdb92f14-2fe9-4d93-bfc0-41e1edb4ea39', election: '26', question: 'שאלה', outcome: 'answered' as const };
test('recording retries bounded transient failures with the same id and reports permanent failure', async () => {
  const original = globalThis.fetch;
  const deliveries: string[] = [];
  let code = 201;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/questions'); assert.equal(options!.keepalive, true);
      deliveries.push(String(options!.body)); return new Response('', { status: code });
    };
    assert.equal(await recordQuestion(attempt), true);
    for (const status of [400, 404, 429, 500]) { code = status; assert.equal(await recordQuestion(attempt), false); }
    assert.ok(deliveries.every(body => body === JSON.stringify(attempt)));
    let attempts = 0;
    globalThis.fetch = async () => { attempts++; if (attempts === 1) throw new Error('offline'); return new Response('', { status: 201 }); };
    assert.equal(await recordQuestion(attempt), true); assert.equal(attempts, 2);
    globalThis.fetch = async () => { throw new Error('offline'); }; assert.equal(await recordQuestion(attempt), false);
  } finally { globalThis.fetch = original; }
});
