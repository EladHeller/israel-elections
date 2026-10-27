import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const baseLabel = 'com.eladheller.israel-elections-results';
const shell = spawnSync('zsh', ['--version']).status === 0 ? 'zsh' : 'bash';

function fixture(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'elections-monitor-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const home = join(dir, 'home');
  const bin = join(dir, 'bin');
  const scripts = join(dir, 'scripts');
  const agents = join(home, 'Library/LaunchAgents');
  for (const path of [bin, scripts, agents, join(dir, 'node_modules/tsx/dist')]) mkdirSync(path, { recursive: true });
  writeFileSync(join(dir, 'node_modules/tsx/dist/cli.mjs'), '');
  for (const name of ['install', 'uninstall']) {
    const file = `${name}-local-election-monitor.sh`;
    writeFileSync(join(scripts, file), readFileSync(resolve('scripts', file), 'utf8').replaceAll('$HOME', '$MONITOR_TEST_HOME'));
  }
  const stub = (name: string, body: string) => writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  stub('node', 'echo "poll $BUCKET $LOCAL_POLL_INTERVAL_MS" >> "$MONITOR_TEST_CALLS"; exit "${MONITOR_TEST_POLL_EXIT:-0}"');
  stub('launchctl', 'echo "launchctl $*" >> "$MONITOR_TEST_CALLS"');
  stub('plutil', 'if [ "$1" = "-extract" ]; then cat "$6"; fi');
  const calls = join(dir, 'calls');
  writeFileSync(calls, '');
  const run = (name: string, args: string[], extra = {}) => spawnSync(shell, [join(scripts, `${name}-local-election-monitor.sh`), ...args], {
    encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, MONITOR_TEST_HOME: home, MONITOR_TEST_CALLS: calls, ...extra },
  });
  return { run, agents, calls: () => readFileSync(calls, 'utf8'), plist: (mode: string) => join(agents, `${baseLabel}.${mode}.plist`) };
}

test('installs both environments with independent services, logs and one-minute overrides', t => {
  const f = fixture(t);
  for (const mode of ['prod', 'dev']) {
    const result = f.run('install', [mode, 'default', '60000']);
    assert.equal(result.status, 0, result.stderr);
    const plist = readFileSync(f.plist(mode), 'utf8');
    assert.ok(plist.includes(`${baseLabel}.${mode}`));
    assert.ok(plist.includes(`/israel-elections/${mode}/results-monitor.log`));
    assert.ok(plist.includes(`/israel-elections/${mode}/results-monitor.error.log`));
    assert.match(plist, /<string>60000<\/string>/);
    assert.ok(plist.includes(mode === 'prod' ? 'israel-election-client-code-bucket' : 'israel-elections-dev-code-bucket'));
  }
  assert.ok(existsSync(f.plist('prod')));
  const before = f.calls().length;
  assert.equal(f.run('install', ['dev']).status, 0);
  assert.ok(!f.calls().slice(before).includes(`${baseLabel}.prod`));
});

test('migrates only the matching legacy environment after a successful preflight', t => {
  const f = fixture(t);
  const legacy = join(f.agents, `${baseLabel}.plist`);
  writeFileSync(legacy, 'israel-election-client-code-bucket');
  assert.equal(f.run('install', ['dev']).status, 0);
  assert.ok(existsSync(legacy));
  assert.equal(f.run('install', ['prod'], { MONITOR_TEST_POLL_EXIT: '1' }).status, 1);
  assert.ok(existsSync(legacy));
  const before = f.calls().length;
  assert.equal(f.run('install', ['prod']).status, 0);
  assert.ok(!existsSync(legacy));
  assert.ok(existsSync(f.plist('dev')));
  const actions = f.calls().slice(before);
  assert.ok(actions.indexOf('poll ') < actions.indexOf('launchctl bootout'));
});

test('uninstall requires an explicit target and preserves the other monitor and logs', t => {
  const f = fixture(t);
  for (const mode of ['prod', 'dev']) assert.equal(f.run('install', [mode]).status, 0);
  assert.equal(f.run('uninstall', []).status, 2);
  assert.equal(f.run('uninstall', ['invalid']).status, 2);
  assert.ok(existsSync(f.plist('prod')) && existsSync(f.plist('dev')));
  assert.equal(f.run('uninstall', ['dev']).status, 0);
  assert.ok(!existsSync(f.plist('dev')) && existsSync(f.plist('prod')));
  const legacy = join(f.agents, `${baseLabel}.plist`);
  writeFileSync(legacy, 'legacy');
  assert.equal(f.run('uninstall', ['legacy']).status, 0);
  assert.ok(!existsSync(legacy) && existsSync(f.plist('prod')));
  assert.equal(f.run('uninstall', ['prod']).status, 0);
  assert.ok(!existsSync(f.plist('prod')));
});
