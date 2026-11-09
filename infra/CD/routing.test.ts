import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const template = readFileSync('infra/CD/t00.cf.yaml', 'utf8');
const source = template.split('FunctionCode: !Sub |\n')[1].split('\n  CDN:')[0]
  .replaceAll('${EnableQuestionAnswers}', 'true').replaceAll('${LatestElectionId}', '26')
  .replaceAll('${ScenarioApiDomain}', '')
  .replace("import cf from 'cloudfront';", '');
const handler = runInNewContext(`${source}\nhandler`);

test('CloudFront rewrites screen URLs without losing query parameters', () => {
  for (const uri of ['/', '/questions', '/questions/', '/questions/1', '/questions/26/', '/results/1', '/results/25', '/results/26/', '/simulator/25', '/research/15', '/research/25', '/research/26/', '/localities/15', '/localities/26/', '/summary', '/summary/']) {
    for (const method of ['GET', 'HEAD']) {
      const request = { uri, method, querystring: { example: { value: '1' } } };
      assert.equal(handler({ request }), request);
      assert.equal(request.uri, '/index.html');
      assert.deepEqual(request.querystring, { example: { value: '1' } });
    }
  }
});

test('direct research links preserve the selected list and request metadata', () => {
  for (const method of ['GET', 'HEAD']) {
    const request = { uri: '/research/26', method, querystring: { party: { value: '%D7%9E%D7%97%D7%9C' } }, headers: { host: { value: 'elections.eladheller.com' } } };
    const response = handler({ request });
    assert.equal(response, request);
    assert.equal(response.uri, '/index.html');
    assert.deepEqual(response.querystring, { party: { value: '%D7%9E%D7%97%D7%9C' } });
    assert.equal(response.headers.host.value, 'elections.eladheller.com');
    assert.equal(response.method, method);
  }
});

test('direct locality and station links preserve the full selection through CloudFront', () => {
  for (const method of ['GET', 'HEAD']) {
    const querystring = { locality: { value: '3000' }, station: { value: encodeURIComponent('["3000","12",1]') } };
    const request = { uri: '/localities/26', method, querystring };
    assert.equal(handler({ request }), request);
    assert.equal(request.uri, '/index.html');
    assert.deepEqual(request.querystring, querystring);
  }
});

test('CloudFront returns an HTTP 404 for unknown screens and invalid elections', () => {
  for (const uri of ['/questions/0', '/questions/27', '/questions/025', '/questions/nope', '/questions/26/extra', '/Questions', '/missing', '/results', '/results/0', '/results/27', '/results/025', '/results/nope', '/simulator/25/extra', '/research', '/research/0', '/research/27', '/research/025', '/research/nope', '/research/25/extra', '/localities', '/localities/0', '/localities/27', '/localities/025', '/localities/nope', '/localities/25/extra', '/Localities/25', '/Research/25', '/Summary']) {
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

test('scenario routes and election data use the intended CDN lifetimes', () => {
  const behaviors = template.split('        CacheBehaviors:\n')[1]
    .split('        DefaultCacheBehavior:')[0]
    .split('          - PathPattern: ').slice(1);
  assert.equal(behaviors.length, 8);
  const previewBehavior = behaviors.shift()!;
  assert.ok(previewBehavior.startsWith('/api/question-preview/*'));
  assert.match(previewBehavior, /QueryString: true/);
  assert.match(previewBehavior, /Forward: none/);
  assert.match(previewBehavior, /MinTTL: 0/);

  assert.ok(behaviors[0].startsWith('/api/*'));
  assert.match(behaviors[0], /AllowedMethods:\n[\s\S]*- POST\n/);
  assert.match(behaviors[0], /CachedMethods:\n\s+- GET\n\s+- HEAD\n/);
  assert.match(behaviors[0], /MinTTL: 0\n/);
  assert.match(behaviors[0], /DefaultTTL: 0\n/);
  assert.match(behaviors[0], /MaxTTL: 31536000\n/);

  assert.ok(behaviors[1].startsWith('/s/*'));
  assert.doesNotMatch(behaviors[1], /- POST\n/);
  assert.match(behaviors[1], /AllowedMethods:\n\s+- GET\n\s+- HEAD\n/);
  assert.match(behaviors[1], /DefaultTTL: 0\n/);
  assert.match(behaviors[1], /MaxTTL: 31536000\n/);

  assert.ok(behaviors[2].startsWith('/election-config.json'));
  assert.ok(behaviors[3].startsWith("!Sub '/data/${CurrentElections}/allResults.json'"));
  assert.ok(behaviors[4].startsWith("!Sub '/data/${CurrentElections}/elections.csv'"));
  assert.ok(behaviors[5].startsWith("!Sub '/data/${CurrentElections}/polling-stations.csv'"));
  for (const behavior of behaviors.slice(2, 6)) {
    assert.match(behavior, /MinTTL: 0\n/);
    assert.match(behavior, /DefaultTTL: 15\n/);
    assert.match(behavior, /MaxTTL: 30\n/);
  }
  assert.ok(behaviors[6].startsWith('/data/*'));
  assert.match(behaviors[6], /MinTTL: 86400\n/);
  assert.match(behaviors[6], /DefaultTTL: 86400\n/);
  assert.match(behaviors[6], /MaxTTL: 31536000\n/);
});

test('direct question links preserve encoded question text through CloudFront', () => {
  const text = 'מה היה קורה אם רעם הייתה מקבלת 10000 פחות קולות';
  const querystring = { q: { value: encodeURIComponent(text) } };
  const request = { uri: '/questions/26', method: 'GET', querystring };
  assert.equal(handler({ request }).uri, '/index.html');
  assert.deepEqual(request.querystring, querystring);
  assert.equal(decodeURIComponent(request.querystring.q.value), text);
});

const question = 'מה היה קורה אם אחוז החסימה היה 1%?';
const crawlerAgents = [
  'facebookexternalhit/1.1',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'facebookexternalhit/1.1 (+https://www.facebook.com/externalhit_uatext.php)',
  'WhatsApp/2.24.6.77 A',
  'WhatsApp/2.24.6 i',
  'WhatsApp/2.24.6.77',
  'Twitterbot/1.0',
];
const previewRequest = (agent = crawlerAgents[0]) => ({
  uri: '/questions/26', method: 'GET',
  querystring: { q: { value: encodeURIComponent(question) } },
  headers: { host: { value: 'elections.eladheller.com' }, 'user-agent': { value: agent } },
});

test('only exact supported sharing agents receive question metadata, without origin or cache access', () => {
  for (const agent of crawlerAgents) {
    const request = previewRequest(agent);
    const response = handler({ request });
    assert.equal(response.statusCode, 200, agent);
    assert.equal(request.uri, '/questions/26');
    assert.equal(response.headers['cache-control'].value, 'no-store');
    assert.match(response.body, new RegExp(`<meta property="og:title" content="${question.replace('?', '\\?')}">`));
    assert.ok(response.body.includes('בחירות לכנסת ה־26'));
    assert.ok(response.body.includes('https://elections.eladheller.com/social/question-26-v2.png'));
    assert.ok(response.body.includes(`https://elections.eladheller.com/questions/26?q=${encodeURIComponent(question)}`));
    assert.ok(response.body.includes('name="twitter:title"'));
  }
});

test('desktop, mobile, in-app browsers and ambiguous bot strings stay on the static path', () => {
  const agents = [
    '', 'Mozilla/5.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 16; SM-A155F) AppleWebKit/537.36 Chrome/142.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1',
    'Mozilla/5.0 WhatsApp/2.24.6.77 A', 'WhatsApp', 'WhatsApp/2.24.6.77 A Browser',
    'facebookexternalhit/1.1.example', 'facebookexternalhit/1.1 (+https://evil.example/)',
    'Mozilla/5.0 facebookexternalhit/1.1 Facebot Twitterbot/1.0',
    'Twitterbot/1.0 Browser', 'Googlebot/2.1', 'bot', 'curl/8.0', 'Facebot',
  ];
  for (const agent of agents) {
    const request = previewRequest(agent);
    assert.equal(handler({ request }), request, agent);
    assert.equal(request.uri, '/index.html', agent);
  }
});

test('browser fetch metadata vetoes even an exact crawler agent', () => {
  for (const agent of crawlerAgents) {
    for (const [name, value] of Object.entries({ 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document', 'sec-fetch-user': '?1', 'sec-fetch-site': 'none' })) {
      const request = previewRequest(agent);
      Object.assign(request.headers, { [name]: { value } });
      assert.equal(handler({ request }), request);
      assert.equal(request.uri, '/index.html');
    }
  }
});

test('malformed, missing, duplicate, oversized and control-character questions use the static site', () => {
  for (const q of [undefined, { value: '' }, { value: '+' }, { value: '%ZZ' }, { value: '%E0%A4' },
    { value: 'a'.repeat(601) }, { value: '%20'.repeat(1400) }, { value: '%00bad' }, { value: '%0Abad' },
    { value: 'one', multiValue: [{ value: 'one' }, { value: 'two' }] }]) {
    const request = previewRequest();
    Object.assign(request, { querystring: q ? { q } : {} });
    assert.equal(handler({ request }), request);
    assert.equal(request.uri, '/index.html');
  }
});

test('preview escapes question HTML and safely decodes form query strings', () => {
  const request = previewRequest();
  request.querystring.q.value = encodeURIComponent('"<script>alert(1)</script>&\' + 1%').replaceAll('%20', '+');
  const response = handler({ request });
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes('&quot;&lt;script&gt;alert(1)&lt;/script&gt;&amp;&#39; + 1%'));
  assert.ok(!response.body.includes('<script>'));
  assert.ok(!response.body.includes('content=""<'));
});

test('preview uses the requested election and environment, with no cross-question cache state', () => {
  for (const [uri, election] of [['/questions', '26'], ['/questions/', '26'], ['/questions/1', '1'], ['/questions/25/', '25']]) {
    const request = previewRequest();
    request.uri = uri;
    request.headers.host.value = 'd123.cloudfront.net';
    const response = handler({ request });
    assert.ok(response.body.includes(`בחירות לכנסת ה־${election}`));
    assert.ok(response.body.includes('https://d123.cloudfront.net/social/'));
  }
  const request = previewRequest();
  request.querystring.q.value = encodeURIComponent('שאלה אחרת');
  assert.ok(!handler({ request }).body.includes(question));
});

test('crawler HEAD has metadata headers but no body; other routes and methods keep existing behavior', () => {
  const request = previewRequest();
  request.method = 'HEAD';
  const response = handler({ request });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, '');
  for (const uri of ['/results/26', '/simulator/26', '/research/26', '/localities/26', '/']) {
    const other = previewRequest();
    other.uri = uri;
    const result = handler({ request: other });
    assert.equal(result.statusCode, 200);
    assert.ok(result.body.includes('/social/elections-26-v2.png'));
    assert.ok(!result.body.includes(question));
  }
  const summary = { ...previewRequest(), uri: '/summary' };
  assert.equal(handler({ request: summary }), summary);
  assert.equal(summary.uri, '/index.html');
  for (const uri of ['/questions/27', '/questions/0', '/questions/026']) {
    assert.equal(handler({ request: { ...previewRequest(), uri } }).statusCode, 404);
  }
  for (const method of ['POST', 'OPTIONS']) {
    const other = { ...previewRequest(), method };
    assert.equal(handler({ request: other }), other);
    assert.equal(other.uri, '/questions/26');
  }
});

test('ambiguous or missing request headers fall back and edge source stays below 10 KB', () => {
  for (const headers of [{}, { ...previewRequest().headers, host: { value: 'bad.example/"<script>' } },
    { ...previewRequest().headers, 'user-agent': { value: crawlerAgents[0], multiValue: [{ value: crawlerAgents[0] }] } }]) {
    const request = { ...previewRequest(), headers };
    assert.equal(handler({ request }), request);
    assert.equal(request.uri, '/index.html');
  }
  assert.ok(Buffer.byteLength(source, 'utf8') < 10_240);
});

test('only verified-by-signature question fetches select the API origin and a separate canonical cache key', () => {
  const selections: string[] = [];
  const apiSource = template.split('FunctionCode: !Sub |\n')[1].split('\n  CDN:')[0]
    .replaceAll('${EnableQuestionAnswers}', 'true').replaceAll('${LatestElectionId}', '26').replaceAll('${ScenarioApiDomain}', 'api.example.com')
    .replace("import cf from 'cloudfront';", '');
  const route = runInNewContext(`${apiSource}\nhandler`, { cf: { selectRequestOriginById: (id: string) => selections.push(id) } });
  for (const agent of crawlerAgents) {
    const request = { ...previewRequest(agent), cookies: { tracking: { value: 'unused' } } };
    request.querystring.q.value = encodeURIComponent(question).replaceAll('%20', '+');
    assert.equal(route({ request }), request);
    assert.equal(request.uri, '/api/question-preview/v1/26');
    assert.equal(request.querystring.q.value, encodeURIComponent(question));
    assert.equal(Object.keys(request.cookies).length, 0);
  }
  assert.equal(selections.length, crawlerAgents.length);
  assert.ok(selections.every(id => id === 'scenario-api'));
  for (const agent of ['Mozilla/5.0 Chrome/142.0', 'Mozilla/5.0 WhatsApp/2.24.6.77 A', 'UnknownBot']) {
    const request = previewRequest(agent);
    route({ request });
    assert.equal(request.uri, '/index.html');
  }
  const navigation = { ...previewRequest(), headers: { ...previewRequest().headers, 'sec-fetch-mode': { value: 'navigate' } } };
  route({ request: navigation }); assert.equal(navigation.uri, '/index.html');
  assert.equal(selections.length, crawlerAgents.length);
  assert.ok(Buffer.byteLength(apiSource) < 10_240);
});
