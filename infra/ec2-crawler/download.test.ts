import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

for (const dataset of ['cities', 'polling-stations']) {
  for (const mode of ['existing', 'new', 'opener', 'timeout', 'click-error']) {
    test(`captures and cleans up ${dataset} ${mode} download flow`, async () => {
      const { downloadCities, downloadPollingStations } = await import('./download.mjs');
      const download = dataset === 'cities' ? downloadCities : downloadPollingStations;
      const context = new EventEmitter() as any;
      const page = new EventEmitter() as any;
      const popup = new EventEmitter();
      const result = { source: 'csv' };
      context.pages = () => mode === 'existing' ? [page, popup, page] : [page];
      const start = async () => {
        if (mode === 'click-error') throw new Error('Click failed');
        if (mode === 'new') context.emit('page', popup);
        if (mode === 'existing' || mode === 'new') popup.emit('download', result);
        if (mode === 'opener') page.emit('download', result);
      };
      page.locator = () => ({ click: start });
      page.evaluate = async action => {
        const opened: unknown[][] = [];
        const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
      Object.defineProperty(globalThis, 'window', { configurable: true, value: { open: (...args) => opened.push(args) } });
      try { action(); } finally {
        if (previous) Object.defineProperty(globalThis, 'window', previous);
        else delete (globalThis as any).window;
      }
      assert.equal(opened[0][0], 'https://media26.bechirot.gov.il/files/expb.csv');
        await start();
      };
      if (mode === 'timeout' || mode === 'click-error') await assert.rejects(download(context, page, 10));
      else assert.equal(await download(context, page), result);
      assert.equal(context.listenerCount('page'), 0);
      assert.equal(page.listenerCount('download'), 0);
      assert.equal(popup.listenerCount('download'), 0);
    });
  }

}
