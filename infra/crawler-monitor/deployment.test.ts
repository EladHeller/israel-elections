import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('deploy generates executable inline Lambda code and keeps email optional and updates idempotent', t => {
  const dir = mkdtempSync(join(tmpdir(), 'crawler-monitor-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const template = join(dir, 'template.yaml');
  const calls = join(dir, 'calls');
  writeFileSync(join(dir, 'aws'), `#!/bin/bash
set -eu
echo "$*" >> "$CALLS"
if [[ "$2" = describe-stack-resource ]]; then echo crawler-role; exit 0; fi
while (( $# )); do
  if [[ "$1" = --template-file ]]; then cp "$2" "$TEMPLATE"; fi
  shift
done
`, { mode: 0o755 });
  const run = (email: string) => spawnSync('bash', [resolve('scripts/deploy-crawler-monitor.sh')], { encoding: 'utf8', env: {
    ...process.env, PATH: dir + ':' + process.env.PATH, TEMPLATE: template, CALLS: calls, CRAWLER_ALERT_EMAIL: email,
  } });
  const first = run('');
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /without an email subscription/);
  assert.match(readFileSync(calls, 'utf8'), /--no-fail-on-empty-changeset/);
  assert.match(readFileSync(calls, 'utf8'), /CrawlerRole=crawler-role/);
  const code = spawnSync('python3', ['-c', "import yaml,sys;print(yaml.safe_load(open(sys.argv[1]))['Resources']['Monitor']['Properties']['Code']['ZipFile'])", template], { encoding: 'utf8' });
  assert.equal(code.status, 0, code.stderr);
  assert.doesNotMatch(code.stdout, /require\('\.\/health.cjs'\)/);
  const check = spawnSync(process.execPath, ['--check'], { input: code.stdout, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const second = run('alerts@example.com');
  assert.equal(second.status, 0, second.stderr);
  assert.doesNotMatch(second.stdout, /warning/);
  assert.match(readFileSync(calls, 'utf8'), /AlertEmail=alerts@example.com/);
  const failed = spawnSync('bash', [resolve('scripts/deploy-crawler-monitor.sh')], { encoding: 'utf8', env: {
    ...process.env, PATH: dir + ':' + process.env.PATH, TEMPLATE: '/missing/path/file', CALLS: calls,
  } });
  assert.notEqual(failed.status, 0, 'deployment failures propagate');
});
