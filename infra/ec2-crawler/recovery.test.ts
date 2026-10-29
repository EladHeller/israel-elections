import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('browser recovery scopes errors to the failed run, waits for readiness and leaves source failures alone', t => {
  const dir = mkdtempSync(join(tmpdir(), 'crawler-recover-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const calls = join(dir, 'calls');
  const stub = (name: string, body: string) => writeFileSync(join(dir, name), '#!/bin/bash\n' + body, { mode: 0o755 });
  stub('systemctl', 'echo "systemctl $*" >> "$CALLS"; if [[ "$1" = show ]]; then echo "${STARTED:-}"; fi\n');
  stub('journalctl', 'echo "journalctl $*" >> "$CALLS"; echo "$FAILURE"\n');
  stub('curl', 'echo curl >> "$CALLS"; [[ "${READY:-1}" = 1 ]]\n');
  stub('sleep', 'echo sleep >> "$CALLS"\n');
  const run = (extra: Record<string, string> = {}) => {
    writeFileSync(calls, '');
    const result = spawnSync('bash', [resolve('infra/ec2-crawler/recover-browser.sh')], { encoding: 'utf8', env: {
      ...process.env, PATH: dir + ':' + process.env.PATH, CALLS: calls, STARTED: 'Thu 2026-10-29 07:00:00 UTC', FAILURE: 'browserType.connectOverCDP: Timeout 30000ms exceeded.', ...extra,
    } });
    return { ...result, calls: readFileSync(calls, 'utf8') };
  };
  const recovered = run();
  assert.equal(recovered.status, 0, recovered.stderr);
  assert.match(recovered.calls, /--since Thu 2026-10-29 07:00:00 UTC/);
  assert.match(recovered.calls, /systemctl restart election-desktop.service/);
  const sourceFailure = run({ FAILURE: 'Downloaded content is not a city results CSV' });
  assert.equal(sourceFailure.status, 0);
  assert.doesNotMatch(sourceFailure.calls, /restart|curl/);
  const missingInvocation = run({ STARTED: '' });
  assert.equal(missingInvocation.status, 0);
  assert.doesNotMatch(missingInvocation.calls, /journalctl|restart/);
  const unavailable = run({ READY: '0' });
  assert.notEqual(unavailable.status, 0);
  assert.equal(unavailable.calls.split('curl').length - 1, 30);
  assert.equal(unavailable.calls.split('systemctl restart').length - 1, 1);
  const unit = readFileSync('infra/ec2-crawler/election-browser-recovery.service', 'utf8');
  assert.match(unit, /StartLimitIntervalSec=300/);
  assert.match(unit, /StartLimitBurst=2/);
  assert.match(readFileSync('infra/ec2-crawler/election-publisher.service', 'utf8'), /OnFailure=election-browser-recovery.service/);
});
