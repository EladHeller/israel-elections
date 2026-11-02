import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

for (const mode of ['present', 'absent', 'denied', 'wait-failed']) {
  test(`crawler teardown handles ${mode} stacks safely`, t => {
    const dir = mkdtempSync(join(tmpdir(), 'crawler-teardown-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    mkdirSync(join(dir, 'bin'));
    const calls = join(dir, 'calls');
    writeFileSync(calls, '');
    writeFileSync(join(dir, 'bin/aws'), `#!/bin/bash
set -eu
echo "$*" >> "$CALLS"
if [[ "$1 $2" = 'cloudformation describe-stacks' ]]; then
  case "$MODE" in
    absent) echo "Stack with id $4 does not exist" >&2; exit 1 ;;
    denied) echo AccessDenied >&2; exit 1 ;;
    *) echo '{"Stacks":[{"StackStatus":"CREATE_COMPLETE"}]}' ;;
  esac
fi
if [[ "$1 $2" = 'cloudformation wait' && "$MODE" = wait-failed ]]; then exit 1; fi
`, { mode: 0o755 });
    const result = spawnSync('bash', [resolve('scripts/teardown-ec2-crawler.sh')], {
      encoding: 'utf8', env: { ...process.env, PATH: join(dir, 'bin') + ':' + process.env.PATH, MODE: mode, CALLS: calls },
    });
    const log = readFileSync(calls, 'utf8');
    if (mode === 'present') {
      assert.equal(result.status, 0, result.stderr);
      assert.ok(log.indexOf('disable-alarm-actions') < log.indexOf('delete-stack'));
      assert.ok(log.indexOf('wait stack-delete-complete --stack-name Israel-elections-crawler-monitor') < log.indexOf('delete-stack --stack-name Israel-elections-ec2-crawler'));
      assert.match(log, /wait stack-delete-complete --stack-name Israel-elections-ec2-crawler/);
    } else if (mode === 'absent') {
      assert.equal(result.status, 0, result.stderr);
      assert.doesNotMatch(log, /delete-stack/);
    } else {
      assert.notEqual(result.status, 0);
      assert.doesNotMatch(log, /delete-stack --stack-name Israel-elections-ec2-crawler/);
    }
    assert.doesNotMatch(log, /s3|Israel-elections-code-bucket/);
  });
}
