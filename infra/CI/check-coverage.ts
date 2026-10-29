import { readFile, appendFile } from 'node:fs/promises';

// Preserve the current baseline, including the two existing uncovered branches.
const thresholds = { lines: 100, statements: 100, functions: 100, branches: 99.84 };

async function checkCoverage() {
  const { total } = JSON.parse(await readFile('./coverage/coverage-summary.json', 'utf-8'));
  const rows: string[] = [];
  let passed = true;
  for (const [metric, threshold] of Object.entries(thresholds)) {
    const percentage = total?.[metric]?.pct;
    const valid = typeof percentage === 'number' && Number.isFinite(percentage)
      && percentage >= threshold && percentage <= 100;
    passed &&= valid;
    const result = `${metric}: ${percentage ?? 'missing'}% (minimum ${threshold}%) — ${valid ? 'PASS' : 'FAIL'}`;
    console.log(result);
    rows.push(`| ${metric} | ${percentage ?? 'missing'}% | ${threshold}% | ${valid ? 'PASS' : 'FAIL'} |`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
      `## Test coverage\n\n| Metric | Coverage | Minimum | Result |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`);
  }
  if (!passed) process.exitCode = 1;
}

checkCoverage().catch(error => {
  console.error('Unable to check coverage:', error.message);
  process.exitCode = 1;
});
