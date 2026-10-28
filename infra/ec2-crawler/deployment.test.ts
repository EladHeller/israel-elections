import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, readlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ref = 'a'.repeat(40);
function fixture(t: TestContext, previous = true) {
  const dir = mkdtempSync(join(tmpdir(), 'crawler-deploy-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'root');
  const bin = join(dir, 'bin');
  const units = join(dir, 'units');
  const source = join(dir, 'source');
  const config = join(dir, 'env');
  for (const path of [root, bin, units, join(source, 'infra/ec2-crawler')]) mkdirSync(path, { recursive: true });
  const files = ['crawl.mjs', 'download.mjs', 'publish.cjs', 'election-publisher.service', 'election-publisher.timer'];
  for (const file of files) writeFileSync(join(source, 'infra/ec2-crawler', file), 'new-' + file);
  const artifact = join(dir, 'source.tar.gz');
  assert.equal(spawnSync('tar', ['-czf', artifact, '-C', dir, 'source']).status, 0);
  const calls = join(dir, 'calls');
  writeFileSync(calls, '');
  const stub = (name: string, code: string) => writeFileSync(join(bin, name), '#!/bin/bash\nset -eu\n' + code + '\n', { mode: 0o755 });
  stub('curl', 'echo curl >> "$CALLS"; cp "$ARTIFACT" "$4"');
  stub('chown', 'true');
  stub('sudo', 'shift 2; exec "$@"');
  stub('npm', 'echo "npm $*" >> "$CALLS"; if [[ "$1" = ci && "${FAIL_BUILD:-0}" = 1 ]]; then exit 7; fi; if [[ "$1" = run ]]; then mkdir -p dist; echo module > dist/csv-monitor.js; fi');
  stub('journalctl', 'echo journal >> "$CALLS"');
  stub('shutdown', 'echo shutdown >> "$CALLS"');
  stub('systemctl', `echo "systemctl $*" >> "$CALLS"
case "$1" in
 is-active) test -f "$CRAWLER_ROOT/active" ;;
 is-enabled) test -f "$CRAWLER_ROOT/enabled" ;;
 stop) if [[ "$*" = *timer* ]]; then rm -f "$CRAWLER_ROOT/active"; fi ;;
 enable) touch "$CRAWLER_ROOT/enabled"; if [[ "$*" = *--now* ]]; then touch "$CRAWLER_ROOT/active"; fi ;;
 disable) rm -f "$CRAWLER_ROOT/enabled" ;;
 start)
   if [[ "$2" = election-publisher.timer ]]; then touch "$CRAWLER_ROOT/active";
   elif [[ "$(readlink "$CRAWLER_ROOT/app")" = *-v2 && "\${FAIL_HEALTH:-0}" = 1 ]]; then exit 8; fi ;;
esac`);
  const old = join(root, 'releases', 'old');
  if (previous) {
    mkdirSync(old, { recursive: true });
    symlinkSync(old, join(root, 'app'));
    writeFileSync(config, 'old-config');
    writeFileSync(join(root, 'deployed'), 'old-marker');
    writeFileSync(join(root, 'active'), '');
    writeFileSync(join(root, 'enabled'), '');
    for (const file of files) writeFileSync(join(file.startsWith('election-') ? units : root, file), 'old-' + file);
  }
  const run = (extra = {}) => spawnSync('bash', [resolve('infra/ec2-crawler/install-release.sh')], { encoding: 'utf8', env: {
    ...process.env, PATH: bin + ':' + process.env.PATH, CRAWLER_ROOT: root, CRAWLER_UNITS: units, CRAWLER_CONFIG: config,
    SOURCE_REF: ref, BUCKET: 'results-bucket', DISTRIBUTION_ID: 'DIST123', REGION: 'us-east-1', CALLS: calls, ARTIFACT: artifact, ...extra,
  } });
  return { dir, root, config, units, old, run, calls: () => readFileSync(calls, 'utf8'), clear: () => writeFileSync(calls, '') };
}

test('deploys once and makes identical deployments a no-op without restarting services', t => {
  const f = fixture(t);
  const first = f.run();
  assert.equal(first.status, 0, first.stderr);
  assert.equal(readlinkSync(join(f.root, 'app')), join(f.root, 'releases', ref + '-v2'));
  assert.match(readFileSync(f.config, 'utf8'), /BUCKET=results-bucket/);
  f.clear();
  const second = f.run();
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /Already deployed/);
  assert.doesNotMatch(f.calls(), /curl|npm|systemctl stop|systemctl start|enable|shutdown/);
});

test('a failed preparation keeps the old release and timer running', t => {
  const f = fixture(t);
  const result = f.run({ FAIL_BUILD: '1' });
  assert.notEqual(result.status, 0);
  assert.equal(readlinkSync(join(f.root, 'app')), f.old);
  assert.equal(readFileSync(f.config, 'utf8'), 'old-config');
  assert.ok(existsSync(join(f.root, 'active')));
  assert.doesNotMatch(f.calls(), /systemctl stop/);
});

test('failed activation restores release, files, environment, marker and timer', t => {
  const f = fixture(t);
  const result = f.run({ FAIL_HEALTH: '1' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /restoring the previous release/);
  assert.equal(readlinkSync(join(f.root, 'app')), f.old);
  assert.equal(readFileSync(f.config, 'utf8'), 'old-config');
  assert.equal(readFileSync(join(f.root, 'deployed'), 'utf8'), 'old-marker');
  assert.equal(readFileSync(join(f.root, 'crawl.mjs'), 'utf8'), 'old-crawl.mjs');
  assert.equal(readFileSync(join(f.units, 'election-publisher.service'), 'utf8'), 'old-election-publisher.service');
  assert.ok(existsSync(join(f.root, 'active')));
  assert.ok(existsSync(join(f.root, 'enabled')));
  f.clear();
  assert.equal(f.run().status, 0);
  assert.doesNotMatch(f.calls(), /curl|npm/);
});

test('failed first installation leaves no active pointer, config or enabled timer', t => {
  const f = fixture(t, false);
  assert.notEqual(f.run({ FAIL_HEALTH: '1' }).status, 0);
  for (const name of ['app', 'deployed', 'active', 'enabled', 'crawl.mjs']) assert.equal(existsSync(join(f.root, name)), false, name);
  assert.equal(existsSync(f.config), false);
});

test('a configuration change reuses the built release and updates the environment', t => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  f.clear();
  assert.equal(f.run({ BUCKET: 'another-bucket' }).status, 0);
  assert.match(readFileSync(f.config, 'utf8'), /BUCKET=another-bucket/);
  assert.doesNotMatch(f.calls(), /curl|npm/);
  assert.match(f.calls(), /systemctl start election-publisher.service/);
});

test('reapplying the current legacy SHA does not overwrite its directory during preparation', t => {
  const f = fixture(t);
  // A previous installer used releases/SHA with no preparation marker.
  const legacy = join(f.root, 'releases', ref);
  mkdirSync(legacy);
  writeFileSync(join(legacy, 'keep'), 'old release');
  rmSync(join(f.root, 'app'));
  symlinkSync(legacy, join(f.root, 'app'));
  assert.notEqual(f.run({ FAIL_HEALTH: '1' }).status, 0);
  assert.equal(readlinkSync(join(f.root, 'app')), legacy);
  assert.equal(readFileSync(join(legacy, 'keep'), 'utf8'), 'old release');
});

function infrastructure(t: TestContext, mode: string) {
  const dir = mkdtempSync(join(tmpdir(), 'crawler-infra-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const calls = join(dir, 'calls');
  writeFileSync(calls, '');
  const existing = { Resources: { Instance: { Properties: { UserData: { 'Fn::Base64': 'exact deployed bootstrap including legacy application code\n' } } } } };
  writeFileSync(join(dir, 'existing.json'), JSON.stringify({ TemplateBody: existing }));
  writeFileSync(join(bin, 'aws'), `#!/usr/bin/env python3
import sys,os,json,pathlib
args=sys.argv[1:]
with open(os.environ['INFRA_CALLS'],'a') as f: f.write(' '.join(args)+'\\n')
mode=os.environ['INFRA_MODE']
if args[:2]==['cloudformation','describe-stacks']:
    if '--query' in args: print('i-test')
    elif mode=='denied': print('AccessDenied',file=sys.stderr); sys.exit(1)
    elif mode=='create': print('Stack with id Israel-elections-ec2-crawler does not exist',file=sys.stderr); sys.exit(1)
    else: print('{}')
elif args[:2]==['cloudformation','describe-stack-resource']: print('i-test')
elif args[:2]==['ec2','describe-instances']: print('ami-pinned')
elif args[:2]==['ssm','get-parameter']: print('ami-initial')
elif args[:2]==['cloudformation','get-template']: print(pathlib.Path(os.environ['INFRA_EXISTING']).read_text())
elif args[:2]==['cloudformation','validate-template']:
    body=pathlib.Path(args[args.index('--template-body')+1].removeprefix('file://')).read_text()
    pathlib.Path(os.environ['INFRA_GENERATED']).write_text(body)
elif args[:2]==['cloudformation','create-change-set']: print('arn:test-change-set')
elif args[:3]==['cloudformation','wait','change-set-create-complete'] and mode in ['empty','failed']: sys.exit(1)
elif args[:2]==['cloudformation','describe-change-set']:
    if mode in ['empty','failed']: print(json.dumps({'Status':'FAILED','StatusReason':"The submitted information didn't contain changes" if mode=='empty' else 'Invalid parameter'}))
    else: print(json.dumps({'Changes':[{'ResourceChange':{'LogicalResourceId':'Instance','Action':'Add' if mode=='create' else 'Modify','Replacement': 'True' if mode=='replace' else 'Conditional' if mode=='conditional' else 'False'}}]}))
`, { mode: 0o755 });
  const run = (extra = {}) => spawnSync('bash', [resolve('scripts/deploy-ec2-crawler.sh')], { encoding: 'utf8', env: {
    ...process.env, PATH: bin + ':' + process.env.PATH, INFRA_CALLS: calls, INFRA_MODE: mode,
    INFRA_EXISTING: join(dir, 'existing.json'), INFRA_GENERATED: join(dir, 'template.json'), ...extra,
  } });
  return { run, calls: () => readFileSync(calls, 'utf8'), generated: () => JSON.parse(readFileSync(join(dir, 'template.json'), 'utf8')), existing };
}

test('updating infrastructure preserves the running image and UserData byte for byte', t => {
  const f = infrastructure(t, 'update');
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const template = f.generated();
  assert.equal(template.Parameters.LatestAmiId.Type, 'AWS::EC2::Image::Id');
  assert.equal(template.Parameters.LatestAmiId.Default, 'ami-pinned');
  assert.deepEqual(template.Resources.Instance.Properties.UserData, f.existing.Resources.Instance.Properties.UserData);
  assert.doesNotMatch(f.calls(), /ssm get-parameter/);
  assert.match(f.calls(), /execute-change-set/);
});

test('new infrastructure resolves the initial AMI once and embeds only infrastructure bootstrap', t => {
  const f = infrastructure(t, 'create');
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.generated().Parameters.LatestAmiId.Default, 'ami-initial');
  assert.equal(f.generated().Resources.Instance.Properties.UserData['Fn::Base64'], readFileSync('infra/ec2-crawler/bootstrap.sh', 'utf8'));
  assert.doesNotMatch(f.generated().Resources.Instance.Properties.UserData['Fn::Base64'], /downloadCities|publishResultsCsv/);
  assert.match(f.calls(), /stack-create-complete/);
});

test('empty change sets succeed without executing any infrastructure update', t => {
  const f = infrastructure(t, 'empty');
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(f.calls(), /delete-change-set/);
  assert.doesNotMatch(f.calls(), /execute-change-set/);
});

for (const mode of ['replace', 'conditional', 'failed', 'denied']) {
  test(`rejects ${mode} infrastructure changes before execution`, t => {
    const f = infrastructure(t, mode);
    assert.notEqual(f.run().status, 0);
    assert.doesNotMatch(f.calls(), /execute-change-set/);
  });
}

test('a different explicitly requested AMI cannot replace the current instance through normal deployment', t => {
  const f = infrastructure(t, 'update');
  assert.notEqual(f.run({ AMI_ID: 'ami-other' }).status, 0);
  assert.doesNotMatch(f.calls(), /create-change-set/);
});

test('rollback preserves a deliberately disabled and inactive timer', t => {
  const f = fixture(t);
  rmSync(join(f.root, 'active'));
  rmSync(join(f.root, 'enabled'));
  assert.notEqual(f.run({ FAIL_HEALTH: '1' }).status, 0);
  assert.equal(readlinkSync(join(f.root, 'app')), f.old);
  assert.equal(existsSync(join(f.root, 'active')), false);
  assert.equal(existsSync(join(f.root, 'enabled')), false);
});

test('status bucket changes reach the publisher environment and invalidate the deployment identity', t => {
  const f = fixture(t);
  assert.equal(f.run({ CRAWLER_STATUS_BUCKET: 'status-one' }).status, 0);
  assert.match(readFileSync(f.config, 'utf8'), /CRAWLER_STATUS_BUCKET=status-one/);
  f.clear();
  assert.equal(f.run({ CRAWLER_STATUS_BUCKET: 'status-two' }).status, 0);
  assert.match(readFileSync(f.config, 'utf8'), /CRAWLER_STATUS_BUCKET=status-two/);
  assert.doesNotMatch(f.calls(), /curl|npm/, 'same prepared source can be reused');
  assert.match(f.calls(), /systemctl start election-publisher.service/);
});
