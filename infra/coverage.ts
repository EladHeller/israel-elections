import fs from 'node:fs/promises';

export interface CoverageData {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

export interface CoverageReport {
  lines: CoverageData;
  statements: CoverageData;
  functions: CoverageData;
  branches:CoverageData;
}

export interface CoverageSummery {
  total: CoverageReport;
  [file: string]: CoverageReport;
}

export async function getCoverageJson(): Promise<CoverageSummery> {
  const coverage = await fs.readFile('coverage/coverage-summary.json', 'utf8');
  return JSON.parse(coverage);
}

const COVERAGE_REPORT_KEYS = ['lines', 'statements', 'functions', 'branches'];

export async function coveragePercents(): Promise<number> {
  const coverageSummery = await getCoverageJson();

  return COVERAGE_REPORT_KEYS.reduce((coverage, key) => {
    const coverageData = coverageSummery.total[key];
    return coverage + (coverageData.pct / COVERAGE_REPORT_KEYS.length);
  }, 0);
}
