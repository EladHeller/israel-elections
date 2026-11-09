const { readFileSync, writeFileSync, mkdirSync, copyFileSync } = require('node:fs');
const path = 'dist/preview-runtime/elections-client/src/lib/party-research.js';
const source = readFileSync(path, 'utf8');
const browserEntry = 'require("csv-parse/browser/esm/sync")';
if (source.split(browserEntry).length !== 2) throw new Error('Expected exactly one browser CSV import in the compiled preview runtime');
writeFileSync(path, source.replace(browserEntry, 'require("csv-parse/sync")'));

mkdirSync('dist/preview-runtime/preview-runtime', { recursive: true });
copyFileSync('elections-client/scripts/fonts/PreviewSans.ttf', 'dist/preview-runtime/preview-runtime/PreviewSans.ttf');
