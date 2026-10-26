# Israeli Elections Monitor

[![CI](https://github.com/EladHeller/israel-elections/actions/workflows/linter.yml/badge.svg)](https://github.com/EladHeller/israel-elections/actions/workflows/linter.yml)
[![CD](https://github.com/EladHeller/israel-elections/actions/workflows/deploy.yml/badge.svg)](https://github.com/EladHeller/israel-elections/actions/workflows/deploy.yml)

A comprehensive platform for collecting, analyzing, and visualizing Israeli election results. The system features a backend listener for data ingestion and a modern web dashboard for interactive simulation and analysis.

## Repository Layout

```
/election-results-listener    Lambda source (TypeScript) - Data ingestion and calculation
/elections-client             React application (Vite + TypeScript) - Interactive dashboard
/infra                        Infrastructure (S3, CloudFront) and CI/CD scripts
/scripts                      Utility scripts
.github/workflows             CI/CD pipelines
```

### election-results-listener

A TypeScript AWS Lambda that operates in two modes:

*   **Scheduled Monitor**: Automatically downloads official results from the Central Elections Committee, calculates seat distribution, and persists data to S3.
*   **On-demand Calculator**: Exposes an API to perform mandate calculations for arbitrary vote distributions using the official Bader–Ofer algorithm.

Seat allocation logic is centralized in `calc-elections.ts`, supporting both the historical Bader–Ofer method and modern simulation scenarios.

### elections-client

A sophisticated React dashboard that allows users to explore election results in depth:

*   **Real-time Simulator**: Adjust vote counts for individual parties and see the impact on seat distribution instantly.
*   **Bloc Analysis**: Visualize coalition possibilities and bloc totals with interactive donut charts.
*   **Surplus Agreements**: Configure and test different surplus agreement scenarios between parties.
*   **Calculation Transparency**: Includes a "Step-by-step" breakdown that explains exactly how seats were allocated according to the law.
*   **Historical Data**: Access and compare results from all Israeli Knesset elections (1-25).

#### Election lifecycle

The client can publish an upcoming election before result files exist. Election metadata is
stored in `elections-client/src/data/elections-manifests.json` and supports these phases:

* `beforeLists` - the election is visible, with a message that candidate lists are not final.
* `listsFinal` - the ballot letters and list names are displayed from the manifest.
* `voting` - polling is in progress and official results are not shown yet.
* `counting` - the client loads and displays the election result file.
* `final` - the result file is displayed as final.

To publish the lists after registration closes, update the election's phase to `listsFinal`
and populate its `lists` array. Move it to `counting` only after the corresponding
`data/<election>/allResults.json` file is available.

The listener accepts the official pre-election CSV with headers only, or rows of
zero votes, and publishes a zero-result snapshot. It refuses to replace previously
published nonzero counts with an empty snapshot. CSV/HTTP errors still fail without
changing the published results. Stale test results must be reset explicitly.

For withdrawn lists, remove them from the manifest's `lists` array and add their
ballot letters to `withdrawnLists`. The client excludes these letters from loaded
results, including old snapshots and CSV columns that the source still retains.

### Counting progress and turnout estimate

Set `totalVotes` for the current election in
`elections-client/src/data/elections-config.json` to the estimated **total number
of people who voted**, including invalid ballots. Update this number after polls
close and refine it as needed; do not set it to the number counted so far.
Commit the change to the deployed branch and let the normal deployment finish.
The build also publishes this configuration at `/election-config.json`.
Open counting pages refresh the estimate alongside results every 30 seconds,
without requiring a page reload (the CDN may cache it for up to 30 seconds).
Historical election data keeps its existing long cache lifetime.

The prominent counting indicator uses counted valid **and invalid** ballots from
the same CSV snapshot. Older result files without `countedVotes` use the available
valid-vote count with an explicit notice that invalid votes are excluded. Missing,
zero, or exceeded turnout estimates display the counted number without inventing
a percentage. Below 5%, a highlighted warning explains that the early results can
differ substantially from the final outcome. The indicator appears only while
counting, outside the simulator; demo data remains explicitly marked.

### infra

Cloud-native infrastructure management:

*   **CI**: Automated linting, type-checking, and unit testing with coverage reporting.
*   **CD**: Shell scripts and TypeScript utilities to manage AWS CloudFormation stacks, Lambda updates, S3 synchronization, and CloudFront invalidation.

## Development

### Prerequisites

*   Node.js (v18+)
*   AWS CLI (configured for deployment)

### Setup

```bash
# Install root dependencies
npm install

# Install client dependencies
cd elections-client && npm install
```

### Running Tests

```bash
# Run all tests (backend and frontend)
npm test

# Run tests with coverage
npm run test:coverage
```

### Local Development (Client)

```bash
cd elections-client
npm run dev
```

## Deployment

The project is fully automated via GitHub Actions. For manual deployments:

```bash
# Build and deploy everything
npm run deploy
```

## Live Demo

The latest version is deployed at:
[https://d2dtitluek3vlq.cloudfront.net/](https://d2dtitluek3vlq.cloudfront.net/)
