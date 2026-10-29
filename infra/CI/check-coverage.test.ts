import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = path.resolve('infra/CI/check-coverage.ts');
const loader = path.resolve('node_modules/tsx/dist/loader.mjs');
const baseline = { lines: { pct: 100 }, statements: { pct: 100 }, functions: { pct: 100 }, branches: { pct: 99.84 } };

test('coverage gate accepts the baseline, reports totals and rejects regressions and corrupt reports', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'coverage-gate-'));
  const summary = path.join(cwd, 'summary.md');
  const env = { ...process.env, GITHUB_STEP_SUMMARY: summary };
  const run = () => spawnSync(process.execPath, ['--import', loader, script], { cwd, env, encoding: 'utf8' });
  try {
    await mkdir(path.join(cwd, 'coverage'));
    const report = path.join(cwd, 'coverage/coverage-summary.json');
    const write = async (total: unknown) => writeFile(report, JSON.stringify({ total }));
    await write(baseline);
    assert.equal(run().status, 0);
    assert.match(await readFile(summary, 'utf8'), /branches \| 99.84% \| 99.84% \| PASS/);
    for (const metric of Object.keys(baseline)) {
      await write({ ...baseline, [metric]: { pct: metric === 'branches' ? 99.83 : 99.99 } });
      const result = run();
      assert.equal(result.status, 1);
      assert.match(result.stdout, new RegExp(`${metric}: .*FAIL`));
    }
    for (const total of [undefined, {}, { ...baseline, lines: { pct: '100' } }, { ...baseline, lines: { pct: 101 } }]) {
      await write(total);
      assert.equal(run().status, 1);
    }
    await write(baseline);
    delete env.GITHUB_STEP_SUMMARY;
    assert.equal(run().status, 0);
    await writeFile(report, 'invalid JSON');
    assert.equal(run().status, 1);
    await rm(report);
    assert.equal(run().status, 1);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
