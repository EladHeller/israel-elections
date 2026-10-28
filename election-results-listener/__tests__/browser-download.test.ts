import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { access, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { summarizeDownloadedCsv, clickCityDownload, runBrowserDownload } from '../browser-download';

const csv = Buffer.from('שם ישוב,כשרים,פסולים,א,ב\nבדיקה,30,2,10,20\n');

test('validates downloaded election data, totals and content fingerprint', () => {
  const result = summarizeDownloadedCsv(csv);
  assert.equal(result.rows, 1);
  assert.equal(result.parties, 2);
  assert.equal(result.validVotes, 30);
  assert.equal(result.countedVotes, 32);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(summarizeDownloadedCsv(Buffer.concat([Buffer.from('\ufeff'), csv])),
    { ...result, bytes: csv.length + 3, sha256: summarizeDownloadedCsv(Buffer.concat([Buffer.from('\ufeff'), csv])).sha256 });
});

test('accepts Hebrew Windows-1255 downloads', () => {
  // Same fixture encoded as a legacy Hebrew CSV, as delivered by older sources.
  const encode = (text: string) => Buffer.from([...text].map(c => {
    const code = c.charCodeAt(0);
    return code >= 0x05d0 && code <= 0x05ea ? code - 0x05d0 + 0xe0 : code;
  }));
  assert.equal(summarizeDownloadedCsv(encode(csv.toString())).countedVotes, 32);
});

test('rejects HTML, empty/header-only files, oversize files and malformed vote counts', () => {
  for (const bytes of [Buffer.alloc(0), Buffer.alloc(30 * 1024 * 1024 + 1),
    Buffer.from('<html>maintenance</html>'), Buffer.from('שם ישוב,א\n'),
    Buffer.from('שם ישוב,א\nבדיקה,nope\n'), Buffer.from('שם ישוב,א,א\nבדיקה,1,2\n')]) {
    assert.throws(() => summarizeDownloadedCsv(bytes));
  }
});

function fixture(mode: 'opener' | 'popup' | 'timeout' | 'click-error' = 'opener', bytes = csv) {
  const context: any = new EventEmitter();
  const page: any = new EventEmitter();
  const popup: any = new EventEmitter();
  const pages = [page];
  let savedPath = '';
  let closed = false;
  const download = {
    url: () => 'https://media26.bechirot.gov.il/files/expc.csv?',
    suggestedFilename: () => 'expc.csv',
    saveAs: async (path: string) => { savedPath = path; await writeFile(path, bytes); },
  };
  page.goto = async (url: string) => {
    assert.equal(url, 'https://votes26.bechirot.gov.il/');
    context.emit('response', { request: () => ({ isNavigationRequest: () => true }),
      url: () => url, status: () => 200, headers: () => ({ 'content-type': 'text/html' }) });
  };
  page.locator = (selector: string) => {
    assert.ok(['#DownloadCSVCities', 'body'].includes(selector));
    return {
      waitFor: async () => {},
      innerText: async () => 'Diagnostic page',
      click: async () => {
        if (mode === 'click-error') throw new Error('Click failed');
        if (mode === 'opener') page.emit('download', download);
        if (mode === 'popup') {
          pages.push(popup);
          context.emit('page', popup);
          popup.emit('download', download);
        }
      },
    };
  };
  page.url = () => 'https://votes26.bechirot.gov.il/';
  page.title = async () => 'Results';
  popup.url = download.url;
  popup.title = page.title;
  popup.locator = page.locator;
  context.newPage = async () => page;
  context.pages = () => pages;
  const browser = { newContext: async () => context, version: () => 'test', close: async () => { closed = true; } };
  return { context, page, popup, download, chromium: { launch: async () => browser },
    savedPath: () => savedPath, closed: () => closed };
}

for (const mode of ['opener', 'popup'] as const) {
  test(`captures a ${mode} download emitted during the click and removes listeners`, async () => {
    const f = fixture(mode);
    assert.equal(await clickCityDownload(f.context, f.page), f.download);
    assert.equal(f.context.listenerCount('page'), 0);
    assert.equal(f.page.listenerCount('download'), 0);
    assert.equal(f.popup.listenerCount('download'), 0);
  });
  test(`downloads and validates the ${mode} CSV and deletes temporary files`, async () => {
    const f = fixture(mode);
    const result = await runBrowserDownload(f.chromium);
    assert.equal(result.statusCode, 200);
    const body = JSON.parse(result.body);
    assert.equal(body.ok, true);
    assert.equal(body.csv.countedVotes, 32);
    assert.equal(body.source, f.download.url());
    assert.equal(body.responses[0].status, 200);
    assert.equal(f.closed(), true);
    await assert.rejects(access(dirname(f.savedPath())));
  });
}

for (const mode of ['timeout', 'click-error'] as const) {
  test(`reports ${mode} and removes event listeners`, async () => {
    const f = fixture(mode);
    await assert.rejects(clickCityDownload(f.context, f.page, 10),
      mode === 'timeout' ? /No CSV download/ : /Click failed/);
    assert.equal(f.context.listenerCount('page'), 0);
    assert.equal(f.page.listenerCount('download'), 0);
  });
}

test('HTML downloaded with a CSV filename cannot report success', async () => {
  const f = fixture('popup', Buffer.from('<html>maintenance</html>'));
  const result = await runBrowserDownload(f.chromium);
  assert.equal(result.statusCode, 502);
  assert.equal(JSON.parse(result.body).ok, false);
  assert.equal(JSON.parse(result.body).pages.length, 2);
  assert.equal(f.closed(), true);
  await assert.rejects(access(dirname(f.savedPath())));
});

test('reports browser startup failures', async () => {
  const result = await runBrowserDownload({ launch: async () => { throw new Error('Chromium missing'); } });
  assert.equal(result.statusCode, 502);
  assert.match(JSON.parse(result.body).error, /Chromium missing/);
});

test('Lambda entrypoint returns and logs the diagnostic result', async (t) => {
  const f = fixture();
  const moduleLoader = require('node:module');
  const originalLoad = moduleLoader._load;
  t.mock.method(moduleLoader, '_load', function (request: string, ...args: any[]) {
    return request === 'playwright' ? { chromium: f.chromium } : originalLoad.call(this, request, ...args);
  });
  const log = t.mock.method(console, 'log', () => {});
  const { handler } = await import('../browser-download');
  const result = await handler();
  assert.equal(result.statusCode, 200);
  assert.equal(log.mock.calls[0].arguments[0], result.body);
});
