import fs from 'node:fs/promises';

interface CoverageData {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

interface CoverageReport {
  lines: CoverageData;
  statements: CoverageData;
  functions: CoverageData;
  branches:CoverageData;
}

interface CoverageSummery {
  total: CoverageReport;
  [file: string]: CoverageReport;
}

const COVERAGE_REPORT_KEYS = ['lines', 'statements', 'functions', 'branches'];

const COVERAGE_FILE_PATH = './coverage/coverage-summary.json';
const COVERAGE_THRESHOLD = 100;

async function checkCoverage() {
  const coverageFile = await fs.readFile(COVERAGE_FILE_PATH, 'utf-8');
  const coverageSummery: CoverageSummery = JSON.parse(coverageFile);

  const isPassCoverage = COVERAGE_REPORT_KEYS.reduce((isPass, key) => {
    const coverageData = coverageSummery.total[key];
    const isCurrentPass = coverageData.pct >= COVERAGE_THRESHOLD;
    if (!isCurrentPass) {
      console.error(`❌ ${key} coverage is ${coverageData.pct}%. Under the ${COVERAGE_THRESHOLD}% threshold.`);
    }
    return isPass && isCurrentPass;
  }, true);

  if (!isPassCoverage) {
    process.exit(1);
  }
}

checkCoverage();
