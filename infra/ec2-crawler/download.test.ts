import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

for (const dataset of ['cities', 'polling-stations']) {
  for (const mode of ['existing', 'new', 'opener', 'timeout', 'click-error', 'unrelated']) {
    test(`captures and cleans up ${dataset} ${mode} download flow`, async () => {
      const { downloadCities, downloadPollingStations } = await import('./download.mjs');
      const download = dataset === 'cities' ? downloadCities : downloadPollingStations;
      const context = new EventEmitter() as any;
      const page = new EventEmitter() as any;
      const popup = new EventEmitter();
      const expectedUrl = `https://media26.bechirot.gov.il/files/${dataset === 'cities' ? 'expc' : 'expb'}.csv`;
      const result = { url: () => expectedUrl + '?' };
      context.pages = () => mode === 'existing' ? [page, popup, page] : [page];
      const start = async () => {
        if (mode === 'click-error') throw new Error('Click failed');
        if (mode === 'new') context.emit('page', popup);
        if (mode === 'existing' || mode === 'new') popup.emit('download', result);
        if (mode === 'opener') page.emit('download', result);
        if (mode === 'unrelated') page.emit('download', { url: () => `https://media26.bechirot.gov.il/files/${dataset === 'cities' ? 'expb' : 'expc'}.csv?` });
        if (mode === 'unrelated') page.emit('download', result);
      };
      page.locator = selector => {
        assert.equal(selector, dataset === 'cities' ? '#DownloadCSVCities' : '#DownloadCSVBallots');
        return { click: start };
      };
      if (mode === 'timeout' || mode === 'click-error') await assert.rejects(download(context, page, 10));
      else assert.equal(await download(context, page), result);
      assert.equal(context.listenerCount('page'), 0);
      assert.equal(page.listenerCount('download'), 0);
      assert.equal(popup.listenerCount('download'), 0);
    });
  }
}
