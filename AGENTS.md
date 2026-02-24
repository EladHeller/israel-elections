# Repository Guidelines

## Project Structure & Module Organization
- `election-results-listener/`: TypeScript AWS Lambda source. Core logic in `calc-elections.ts`, config in `config-elections.json`, handlers in `index.ts` and `csv-monitor.ts`.
- `elections-client/`: Static web client (HTML/CSS/JS) plus per-election data folders (`1/`, `2/`, …).
- `infra/`: CI/CD and deployment tooling (`CI/`, `CD/`, and shared helpers like `s3.ts`).
- Root config: `package.json`, `tsconfig.json`, ESLint configs, and GitHub workflows under `.github/workflows`.

## Build, Test, and Development Commands
- `npm test`: Run unit tests with `tsx --test` over `election-results-listener/**/__tests__` and client tests.
- `npm run type-check`: TypeScript compilation checks (`tsc --noEmit`).
- `npm run lint:test`: Linting via ESLint 9. Note: Configuration is in `eslint.config.mjs` (ESM required for performance).
- `npm run test:ci`: Full CI suite (type-check + coverage + lint).
- `npm run build`: Compile Lambda to `dist/`.
- `npm run deploy`: End-to-end deploy via `infra/CD/deploy.sh` (requires AWS credentials).

## Troubleshooting & Critical Knowledge
### Registry Management
The local registry (`npm.dev.wixpress.com`) may occasionally lack the latest security patches or metadata for specific packages (e.g., `ajv`). This is a common point of failure for automated scripts and AI agents.
- **Guideline**: If `npm audit` or `npm install` fails with "version not found" or "ERESOLVE", force use the public registry using the `--registry` flag:
  `npm install --registry=https://registry.npmjs.org`
- **Tip**: You can also set this temporarily in your shell: `export NPM_CONFIG_REGISTRY=https://registry.npmjs.org`

### Cross-Platform Dependencies (CD Failures)
Generating `package-lock.json` on a Mac (arm64/x64) may omit binary dependencies for Linux (used in GitHub Actions). This causes errors like `Cannot find module '@rollup/rollup-linux-x64-gnu'`.
- **Guideline**: If CD fails due to missing native modules, regenerate the lockfile with explicit platform support:
  `npm install --os=linux --cpu=x64 && npm install`

### Modern Tooling
- **Coverage**: Switched from `nyc` to `c8`. `c8` uses native V8 engine profiling and is significantly more secure (fewer transitive vulnerabilities).
- **Linter**: Upgraded to ESLint 9 (Flat Config). The configuration is recursive (`eslint .`); avoid complex globs in scripts that might accidentally skip file types like `.jsx`.

## Testing Guidelines
- Framework: Node’s native test runner via `tsx --test`.
- Tests live in `__tests__` folders and follow `*.test.ts` (backend) or `*.test.js` (client) naming.
- Coverage: `npm run test:coverage` generates reports via `c8`. CI checks coverage goals via `infra/CI/check-coverage.ts`.

## Security Strategy
- **Dependency Pinning**: `fast-xml-parser` is pinned to `4.1.2` in `package.json` overrides. This version is secure against the high-severity ReDoS vulnerability found in `>=4.1.3` while maintaining compatibility with AWS SDK v3.
- **Vulnerability Checks**: Aim for `found 0 vulnerabilities` in `npm audit`.

## Data Management Guidelines

### Party Names Cleaning
When updating `elections-client/src/data/party-names.json`, ensure that party names are kept concise. 
- **Rule**: Remove "pompous subjectives", slogans, and specific leadership mentions (e.g., everything after separators like " - ", " בראשות ", " עם ", " בהנהגת ", etc.).
- **Goal**: Maintain a clean UI for the charts and avoid political slogans in the data.
- **Example**: `קדימה - עם ציפי לבני לראשות הממשלה` -> `קדימה`.

## Commit & Pull Request Guidelines
- Recent history shows merge commits and Dependabot-style prefixes like `[dependabot]:`.
- For human commits, use concise, imperative summaries (e.g., `Add agreement rounding option`).
- PRs should include a clear summary, linked issues if applicable, and screenshots for `elections-client` UI changes.

## Deployment & Configuration Notes
- Lambda and client artifacts are uploaded to S3 and served via CloudFront; deploys also invalidate CDN caches.
- Verify AWS credentials before running any `infra/CD/*` scripts.
- CD targets two environments: `dev` for `develop` and `prod` for `master` (see `.github/workflows/deploy.yml`).
