import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localResults, localityHref, localityId, stationLabel } from './locality-results';
import { parseLocalities, parsePollingStations } from './party-research';
import { calcVotesResults } from './calc';

test('local seats use the election threshold and agreements with local votes only', () => {
  const row = { id: '1', name: 'עיר', validVotes: 1000, votes: { a: 480, b: 300, c: 180, small: 30, zero: 0, d: 10 } };
  const config = { blockPercentage: .0325, agreements: [['b', 'c']] as [string, string][], algorithm: 'baderOffer' as const };
  const result = localResults(row, config);
  assert.equal(Object.values(result).reduce((total, party) => total + party.mandats, 0), 120);
  assert.equal(result.small, undefined);
  assert.equal(result.zero, undefined);
  assert.deepEqual(result, calcVotesResults(Object.fromEntries(Object.entries(row.votes).map(([party, votes]) => [party, { votes, mandats: 0 }])), .0325, config.agreements, 'baderOffer').realResults);
  assert.ok(localResults(row, { ...config, blockPercentage: .01 }).small.mandats > 0);
  assert.equal(result.a.mandats, 60);
  assert.equal(result.b.mandats + result.c.mandats, 60);
  assert.ok(localResults({ ...row, votes: { a: 0 } }, config));
});

test('links preserve locality, station number and split, including historical rows', () => {
  const csv = 'שם ישוב,סמל ישוב,מספר קלפי,פיצול,כשרים,מחל\nעיר,3000,12,1,100,100\nעיר,3000,12,2,200,200';
  const locality = parseLocalities(csv)[0];
  assert.equal(localityId(locality), '3000');
  assert.equal(localityHref('19', locality), '/localities/19?locality=3000');
  const stations = parsePollingStations(csv);
  for (const row of stations) {
    const url = new URL(localityHref('19', row), 'https://example.org');
    assert.equal(url.searchParams.get('locality'), '3000');
    assert.equal(url.searchParams.get('station'), row.id);
    assert.equal(localityId(row), locality.id);
  }
  assert.equal(stationLabel(stations[0]), 'קלפי 12 (פיצול 1)');
  assert.equal(stationLabel({ ...stations[0], split: 0 }), 'קלפי 12');
});
