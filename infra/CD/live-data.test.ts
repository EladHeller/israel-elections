import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { upload } from '../../dist/infra/s3.js';

test('deployment preserves published results and initializes missing live files atomically', async context => {
  const dir = await mkdtemp(join(tmpdir(), 'elections-deploy-'));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'allResults.json');
  await writeFile(file, '{"countedVotes":0}');
  const objects = new Map<string, string>([['data/26/allResults.json', '{"countedVotes":200000}']]);
  context.mock.method(S3Client.prototype, 'send', async command => {
    assert.ok(command instanceof PutObjectCommand);
    assert.equal(command.input.IfNoneMatch, '*');
    const key = command.input.Key!;
    if (objects.has(key)) throw { $metadata: { httpStatusCode: 412 } };
    objects.set(key, command.input.Body!.toString());
    return {};
  });

  assert.equal(await upload('dev', 'data/26/allResults.json', file, undefined, true), false);
  assert.equal(objects.get('data/26/allResults.json'), '{"countedVotes":200000}');
  assert.equal(await upload('dev', 'data/26/elections.csv', file, undefined, true), true);
  assert.equal(await upload('dev', 'data/26/elections.csv', file, undefined, true), false);

  // Competing initial deployments can only create the object once.
  objects.clear();
  const created = await Promise.all([
    upload('dev', 'data/26/allResults.json', file, undefined, true),
    upload('dev', 'data/26/allResults.json', file, undefined, true),
  ]);
  assert.equal(created.filter(Boolean).length, 1);
});

test('live initialization fails rather than silently continuing on an S3 permission error', async context => {
  const denied = Object.assign(new Error('Access denied'), { $metadata: { httpStatusCode: 403 } });
  context.mock.method(S3Client.prototype, 'send', async () => { throw denied; });
  await assert.rejects(upload('dev', 'data/26/allResults.json', 'package.json', undefined, true), denied);
});

test('deployment protects only the current live output and still updates its source CSV and historical data', async () => {
  const source = await readFile('infra/CD/deploy-all.ts', 'utf8');
  const uploadSource = source.slice(source.indexOf('async function uploadFiles('), source.indexOf('\nfunction scenarioApiDomain('));
  const js = ts.transpileModule(uploadSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const keys = ['data/26/allResults.json', 'data/26/elections.csv', 'data/25/allResults.json', 'data/25/elections.csv', 'test-data/live-results.csv', 'election-config.json', 'index.html'];
  const calls: unknown[][] = [];
  const invalidations: unknown[] = [];
  const run = runInNewContext(`${js}\nuploadFiles`, {
    console: { log() {} }, bucketCodeName: 'code', clientCodeName: 'client', currElections: '26',
    getAllDirsFiles: async () => keys.map(key => ({ file: `./elections-client/dist/${key}` })),
    upload: async (...args: unknown[]) => { calls.push(args); return !args[4]; },
    cfClient: { send: async command => { invalidations.push(command); } },
    CreateInvalidationCommand: class { constructor(public input: unknown) {} },
  });
  await run('distribution');
  for (const key of keys) {
    const call = calls.find(args => args[1] === key)!;
    assert.ok(call, key);
    assert.equal(call[4], key === 'data/26/allResults.json' || key === 'data/26/elections.csv', key);
  }
  const paths = (invalidations[0] as { input: { InvalidationBatch: { Paths: { Items: string[] } } } }).input.InvalidationBatch.Paths.Items;
  assert.ok(paths.includes('/test-data/live-results.csv'));
  assert.ok(!paths.includes('/data/26/allResults.json'));
});
