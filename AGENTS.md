# Repository Guidelines

## Project Structure & Module Organization
- `election-results-listener/`: TypeScript AWS Lambda source. Core logic in `calc-elections.ts`, config in `config-elections.json`, handlers in `index.ts` and `csv-monitor.ts`.
- `elections-client/`: Static web client (HTML/CSS/JS) plus per-election data folders (`1/`, `2/`, …).
- `infra/`: CI/CD and deployment tooling (`CI/`, `CD/`, and shared helpers like `s3.ts`).
- Root config: `package.json`, `tsconfig.json`, ESLint configs, and GitHub workflows under `.github/workflows`.

## Build, Test, and Development Commands
- `npm test`: Run unit tests with `tsx --test` over `election-results-listener/**/__tests__`.
- `npm run type-check`: TypeScript compilation checks (`tsc --noEmit`).
- `npm run lint:test`: ESLint on TypeScript and client JS.
- `npm run test:ci`: Full CI suite (type-check + coverage + lint).
- `npm run build`: Compile Lambda to `dist/`.
- `npm run deploy`: End-to-end deploy via `infra/CD/deploy.sh` (requires AWS credentials).
Note: CI runs both locally (`npm run test:ci`) and in GitHub Actions (`.github/workflows/linter.yml`). CD runs only in GitHub Actions (`.github/workflows/deploy.yml`).

## Coding Style & Naming Conventions
- Indentation: 2 spaces (see `calc-elections.ts` and other TS files).
- TypeScript and JS are linted with ESLint + Airbnb base; TypeScript uses `@typescript-eslint`.
- Filenames are kebab-case (e.g., `calc-elections.ts`, `csv-monitor.ts`).
- Use explicit types where helpful; underscore-prefixed unused parameters are allowed by lint rules.

## Testing Guidelines
- Framework: Node’s `--test` runner via `tsx`.
- Tests live under `election-results-listener/__tests__/` and follow `*.test.ts` naming.
- Coverage: `npm run test:coverage` generates `nyc` reports; CI checks coverage via `infra/CI/check-coverage.ts`.

## Commit & Pull Request Guidelines
- Recent history shows merge commits and Dependabot-style prefixes like `[dependabot]:`.
- For human commits, use concise, imperative summaries (e.g., `Add agreement rounding option`).
- PRs should include a clear summary, linked issues if applicable, and screenshots for `elections-client` UI changes.

## Deployment & Configuration Notes
- Lambda and client artifacts are uploaded to S3 and served via CloudFront; deploys also invalidate CDN caches.
- Verify AWS credentials before running any `infra/CD/*` scripts.
- CD targets two environments: `dev` for `develop` and `prod` for `master` (see `.github/workflows/deploy.yml`).
