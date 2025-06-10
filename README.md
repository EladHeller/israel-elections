# Israeli Elections Monitor

[![CI](https://github.com/EladHeller/israel-elections/actions/workflows/linter.yml/badge.svg)](https://github.com/EladHeller/israel-elections/actions/workflows/linter.yml)
[![CD](https://github.com/EladHeller/israel-elections/actions/workflows/deploy.yml/badge.svg)](https://github.com/EladHeller/israel-elections/actions/workflows/deploy.yml)
[![codecov](https://codecov.io/gh/EladHeller/israel-elections/branch/develop/graph/badge.svg)](https://codecov.io/gh/EladHeller/israel-elections)

A Node/TypeScript project that collects Israeli election results and exposes them through
an AWS Lambda and a lightweight web client.  Historic data and live results are
stored in S3 and served via CloudFront.

## Repository Layout

```
/election-results-listener    Lambda source (TypeScript)
/elections-client             Static web client
/infra                        Infrastructure and deployment scripts
.github/workflows             CI/CD pipelines
```

### election-results-listener

The Lambda handles two modes:

* **Scheduled run** – downloads the official CSV results, converts them to seat
  allocation and uploads JSON output to S3 (see `csv-monitor.ts`).
* **HTTP invocation** – accepts vote data in the request body and returns the
  calculated seat distribution (handled in `index.ts`).

Seat allocation is calculated in `calc-elections.ts` using the
Bader–Ofer (with optional round up) algorithm. Configuration for each election
resides in `config-elections.json` and is loaded via `config.ts`.

### elections-client

A static HTML/JS app that fetches the relevant `allResults.json` file from S3 and
uses D3.js to draw a bar chart of seats per party. Each subdirectory (`1`, `2`, …)
contains the results for a single election.

### infra

Deployment and helper scripts:

* **CI** – coverage checks and uploads.
* **CD** – CloudFormation templates and scripts for uploading Lambda code,
  invalidating CloudFront caches and updating environment variables.

## Development

Install dependencies and run the unit tests:

```bash
npm install
npm test
```

Additional scripts are defined in `package.json`, for example `npm run type-check`
for TypeScript compilation and `npm run lint:test` for ESLint.

### Deploy

The `infra/CD/deploy.sh` script builds the Lambda into `dist`, zips the client and
Lambda artifacts, uploads them to S3 buckets and invalidates the CDN cache.
Make sure your AWS credentials are configured before running:

```bash
npm run deploy
```

## Live Demo

The client is hosted at:

https://d2dtitluek3vlq.cloudfront.net/

