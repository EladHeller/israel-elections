import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync('infra/ec2-crawler/publish.cjs', 'utf8');

for (const failure of ['none', 'station-download', 'station-validation', 'unexpected-path']) {
  test(`publisher downloads and publishes each dataset in order (${failure})`, async () => {
    const calls: string[] = [];
    let completion: Promise<unknown>;
    const process = { execPath: 'node', exitCode: 0 };
    const modules = {
      'node:child_process': { execFile() {} },
      'node:util': { promisify: () => async (_exe, args) => {
        const kind = args[1];
        calls.push(`download:${kind}`);
        if (kind === 'polling-stations' && failure === 'station-download') throw new Error('Download failed');
        return { stdout: JSON.stringify({ ok: true, path: failure === 'unexpected-path' ? '/etc/passwd' : `/home/crawler/downloads/${kind}-123.csv`, sha256: kind, rows: 10 }) };
      } },
      'node:fs/promises': {
        readFile: async path => { calls.push(`read:${path}`); return Buffer.from('נתונים'); },
        unlink: async path => { calls.push(`unlink:${path}`); },
      },
      './app/dist/csv-monitor.js': {
        publishResultsCsv: async csv => { assert.equal(csv, 'נתונים'); calls.push('publish:cities'); },
        publishPollingStationsCsv: async () => {
          calls.push('publish:polling-stations');
          if (failure === 'station-validation') throw new Error('Invalid station CSV');
        },
      },
      './app/infra/ec2-crawler/heartbeat.cjs': {
        statusWriter: () => () => {},
        runWithHeartbeat: work => { completion = work(); return completion; },
      },
    };
    runInNewContext(source, { require: key => {
      assert.ok(key in modules, key);
      return modules[key];
    }, process, TextDecoder, Date, console: { log() {}, error() {} } });
    if (failure === 'none') {
      const result = await completion! as { sha256: string; pollingStations: { sha256: string } };
      assert.equal(result.sha256, 'cities');
      assert.equal(result.pollingStations.sha256, 'polling-stations');
    } else {
      await assert.rejects(completion!);
    }
    if (failure === 'unexpected-path') {
      assert.deepEqual(calls, ['download:cities']);
      return;
    }
    assert.ok(calls.indexOf('publish:cities') < calls.indexOf('download:polling-stations'));
    assert.ok(calls.includes('unlink:/home/crawler/downloads/cities-123.csv'));
    if (failure !== 'station-download') assert.ok(calls.includes('unlink:/home/crawler/downloads/polling-stations-123.csv'));
  });
}
