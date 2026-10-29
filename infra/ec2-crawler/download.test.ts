import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

for (const mode of ['existing', 'new', 'opener', 'timeout', 'click-error']) {
  test(`captures and cleans up ${mode} download flow`, async () => {
    const { downloadCities } = await import('./download.mjs');
    const context = new EventEmitter() as any;
    const page = new EventEmitter() as any;
    const popup = new EventEmitter();
    const result = { source: 'csv' };
    context.pages = () => mode === 'existing' ? [page, popup, page] : [page];
    page.locator = () => ({ click: async () => {
      if (mode === 'click-error') throw new Error('Click failed');
      if (mode === 'new') context.emit('page', popup);
      if (mode === 'existing' || mode === 'new') popup.emit('download', result);
      if (mode === 'opener') page.emit('download', result);
    } });
    if (mode === 'timeout' || mode === 'click-error') await assert.rejects(downloadCities(context, page, 10));
    else assert.equal(await downloadCities(context, page), result);
    assert.equal(context.listenerCount('page'), 0);
    assert.equal(context.listenerCount('response'), 0);
    assert.equal(page.listenerCount('download'), 0);
    assert.equal(popup.listenerCount('download'), 0);
  });
}


for (const [status, location, error] of [
  [302, 'https://maintenance.gov.il/?aspxerrorpath=/files/expc.csv', /government maintenance/],
  [503, '', /HTTP 503/],
  [302, 'http://[bad', /invalid redirect/],
] as const) {
  test(`reports source failure immediately for HTTP ${status} ${location}`, async () => {
    const { downloadCities } = await import('./download.mjs');
    const context = new EventEmitter() as any;
    const page = new EventEmitter() as any;
    context.pages = () => [page];
    page.locator = () => ({ click: async () => context.emit('response', {
      url: () => 'https://media26.bechirot.gov.il/files/expc.csv?', status: () => status, headers: () => ({ location }),
    }) });
    await assert.rejects(downloadCities(context, page, 1000), error);
    assert.equal(context.listenerCount('response'), 0);
    assert.equal(context.listenerCount('page'), 0);
    assert.equal(page.listenerCount('download'), 0);
  });
}

test('ignores unrelated failures and valid source redirects while waiting for the download', async () => {
  const { downloadCities } = await import('./download.mjs');
  const context = new EventEmitter() as any;
  const page = new EventEmitter() as any;
  const result = { source: 'csv' };
  context.pages = () => [page];
  page.locator = () => ({ click: async () => {
    for (const [url, status, location] of [
      ['https://votes26.bechirot.gov.il/image.svg', 503, ''],
      ['https://media26.bechirot.gov.il/files/expb.csv', 503, ''],
      ['https://media26.bechirot.gov.il/files/expc.csv', 200, ''],
      ['https://media26.bechirot.gov.il/files/expc.csv', 302, ''],
      ['https://media26.bechirot.gov.il/files/expc.csv', 302, '/files/expc.csv?latest=1'],
    ] as const) context.emit('response', { url: () => url, status: () => status, headers: () => ({ location }) });
    page.emit('download', result);
  } });
  assert.equal(await downloadCities(context, page), result);
  assert.equal(context.listenerCount('response'), 0);
});
