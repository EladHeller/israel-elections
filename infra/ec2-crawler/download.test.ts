import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { downloadCities } from './download.mjs';

for (const mode of ['existing', 'new', 'opener', 'timeout', 'click-error']) {
  test(`captures and cleans up ${mode} download flow`, async () => {
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
    assert.equal(page.listenerCount('download'), 0);
    assert.equal(popup.listenerCount('download'), 0);
  });
}
