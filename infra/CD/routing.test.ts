import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const template = readFileSync('infra/CD/t00.cf.yaml', 'utf8');
const source = template.split('FunctionCode: !Sub |\n')[1].split('\n  CDN:')[0]
  .replaceAll('${LatestElectionId}', '26');
const handler = runInNewContext(`${source}\nhandler`);

test('CloudFront rewrites screen URLs without losing query parameters', () => {
  for (const uri of ['/', '/results/1', '/results/25', '/results/26/', '/simulator/25', '/summary', '/summary/']) {
    for (const method of ['GET', 'HEAD']) {
      const request = { uri, method, querystring: { example: { value: '1' } } };
      assert.equal(handler({ request }), request);
      assert.equal(request.uri, '/index.html');
      assert.deepEqual(request.querystring, { example: { value: '1' } });
    }
  }
});

test('CloudFront returns an HTTP 404 for unknown screens and invalid elections', () => {
  for (const uri of ['/missing', '/results', '/results/0', '/results/27', '/results/025', '/results/nope', '/simulator/25/extra', '/Summary']) {
    const response = handler({ request: { uri, method: 'GET' } });
    assert.equal(response.statusCode, 404, uri);
    assert.match(response.headers['content-type'].value, /text\/html/);
    assert.match(response.body, /404/);
    assert.match(response.body, /href="\/"/);
  }
});

test('CloudFront leaves static resources and non-read requests unchanged', () => {
  for (const uri of ['/assets/app.js', '/assets/missing', '/data/25/allResults.json', '/data/missing', '/favicon.ico', '/index.html', '/robots.txt']) {
    const request = { uri, method: 'GET' };
    assert.equal(handler({ request }), request);
    assert.equal(request.uri, uri);
  }
  const request = { uri: '/summary', method: 'POST' };
  assert.equal(handler({ request }), request);
  assert.equal(request.uri, '/summary');
});

test('only current mutable result files have a short CDN lifetime', () => {
  const behaviors = template.split('        CacheBehaviors:\n')[1]
    .split('        DefaultCacheBehavior:')[0]
    .split('          - PathPattern: ').slice(1);
  assert.equal(behaviors.length, 3);
  assert.ok(behaviors[0].startsWith("!Sub '/data/${CurrentElections}/allResults.json'"));
  assert.ok(behaviors[1].startsWith("!Sub '/data/${CurrentElections}/elections.csv'"));
  for (const behavior of behaviors.slice(0, 2)) {
    assert.match(behavior, /MinTTL: 0\n/);
    assert.match(behavior, /DefaultTTL: 15\n/);
    assert.match(behavior, /MaxTTL: 30\n/);
  }
  assert.ok(behaviors[2].startsWith('/data/*'));
  assert.match(behaviors[2], /MinTTL: 86400\n/);
  assert.match(behaviors[2], /DefaultTTL: 86400\n/);
  assert.match(behaviors[2], /MaxTTL: 31536000\n/);
});
