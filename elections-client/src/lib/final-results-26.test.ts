import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parse } from 'csv-parse/sync';
import AllElectionsSummary from '../components/AllElectionsSummary';
import configs from '../data/elections-config.json';
import manifests from '../data/elections-manifests.json';
import totals from '../data/elections-valid.json';
import { getCsvResults } from '../../../election-results-listener/csv-data';
import { calcVotesResults } from './calc';
import { shouldRefreshLiveResults } from './live-results';
import type { ElectionConfig, ElectionResultsPayload } from '../types';

const snapshot: ElectionResultsPayload = JSON.parse(readFileSync('elections-client/public/data/26/allResults.json', 'utf8'));
const config = configs['26'] as ElectionConfig;

test('Knesset 26 final snapshots and summary agree with both official CSV files', () => {
  assert.equal(manifests['26'].phase, 'final');
  assert.equal(config.finalResults, true);
  assert.equal(shouldRefreshLiveResults(manifests['26'].phase, 'visible'), false);
  assert.equal(config.totalVotes, 5_717_397);
  assert.equal(config.eligibleVoters, 7_331_981);
  assert.equal(config.turnoutPercentage, Number((100 * config.totalVotes! / config.eligibleVoters!).toFixed(2)));
  for (const file of ['elections.csv', 'polling-stations.csv']) {
    const csv = readFileSync(`elections-client/public/data/26/${file}`, 'utf8');
    const rows = parse(csv, { bom: true, columns: true }) as Record<string, string>[];
    const parties = new Set(manifests['26'].lists.map(list => list.ballotLetter));
    const parsed = getCsvResults(csv, Object.keys(rows[0]).filter(key => !parties.has(key)));
    assert.equal(parsed.countedVotes, config.totalVotes, file);
    assert.deepEqual(parsed.voteData, snapshot.voteData, file);
    assert.equal(rows.reduce((sum, row) => sum + Number(row['בזב']), 0), config.eligibleVoters, file);
  }
  const valid = Object.values(snapshot.voteData).reduce((sum, party) => sum + party.votes, 0);
  assert.equal(valid, 5_691_426);
  assert.equal(snapshot.countedVotes, config.totalVotes);
  assert.equal(config.totalVotes! - valid, 25_971);
  assert.deepEqual(totals['26'], { validVotes: valid, belowThresholdVotes: 306_478 });
  assert.equal(Object.values(snapshot.voteData).filter(party => party.votes < valid * config.blockPercentage)
    .reduce((sum, party) => sum + party.votes, 0), totals['26'].belowThresholdVotes);
  assert.deepEqual(calcVotesResults(snapshot.voteData, config.blockPercentage, config.agreements, config.algorithm).realResults, snapshot.realResults);
  assert.deepEqual(Object.fromEntries(Object.entries(snapshot.realResults).map(([party, result]) => [party, result.mandats])), {
    'מחל': 27, 'דרך': 21, 'רק': 12, 'ודם': 11, 'אמת': 8, 'עם': 8, 'ל': 7, 'ב': 7, 'ג': 7, 'שס': 6, 'ט': 6,
  });
});

test('all-elections summary renders every final Knesset 26 statistic', () => {
  const html = renderToStaticMarkup(createElement(AllElectionsSummary));
  const row = html.match(/<tr><td>26<\/td>(.*?)<\/tr>/)?.[1];
  assert.ok(row);
  for (const value of ['77.98%', '5,717,397', '25,971', '5,691,426', '3.25%', '5.38%']) assert.ok(row.includes(value), value);
});
