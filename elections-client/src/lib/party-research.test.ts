import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseLocalities, parsePollingStations, rankLocalities } from './party-research';
import { hasLocalityData, LOCALITY_ELECTIONS, pollingStationSource, hasEmbeddedPollingStations } from './locality-availability';

test('research is available only for elections with verified locality sources', () => {
  for (const election of LOCALITY_ELECTIONS) assert.ok(hasLocalityData(election));
  for (const election of [null, '', '1', '14', '27', '../25']) assert.equal(hasLocalityData(election), false);
});

test('aggregates polling stations by locality code, normalizes headers and excludes non-locality votes', () => {
  const data = parseLocalities('\ufeffשם ישוב,סמל ישוב,כשרים, א ,ב,חיצוניות,קלפי אחרת,\r\n"עיר, א",0001,100,30,70,3,4,\r\n"עיר, א",1,100,50,50,2,3,\r\nקטן,2,10,9,1,0,0,\r\nמעטפות כפולות,0,100,100,0,0,0,\r\n,0,100,100,0,0,0,\r\nריק,3,0,0,0,0,0,\r\n');
  assert.equal(data.length, 2);
  assert.deepEqual(data[0], { id: '1', name: 'עיר, א', validVotes: 200, votes: { א: 80, ב: 120 } });
  assert.deepEqual(rankLocalities(data, 'א', 'votes').map(row => row.name), ['עיר, א', 'קטן']);
  assert.deepEqual(rankLocalities(data, 'א', 'percentage').map(row => row.name), ['קטן', 'עיר, א']);
  assert.equal(rankLocalities(data, 'א', 'percentage')[0].percentage, 90);
  assert.equal(rankLocalities(data, 'א', 'votes', 100).length, 1);
  assert.equal(rankLocalities(data, 'missing', 'votes').length, 0);
  assert.equal(rankLocalities(data, 'א', 'votes', 201).length, 0);
});

test('supports locality names without codes and stable ties', () => {
  const data = parseLocalities('שם ישוב,כשרים,א,ב\rא,10,5,5\rב,20,10,10\rג,20,10,10\rמעטפות כפולות,50,50,0\r');
  assert.equal(data.length, 3);
  assert.deepEqual(rankLocalities(data, 'א', 'percentage').map(row => row.name), ['ב', 'ג', 'א']);
  assert.equal(rankLocalities(data, 'ב', 'votes')[0].partyVotes, 10);
});

test('rejects malformed source data instead of displaying misleading rankings', () => {
  for (const csv of ['', 'x,y\n1,2', 'שם ישוב,כשרים,כשרים\na,1,1', 'שם ישוב,כשרים\na,1',
    'שם ישוב,כשרים,א\na,-1,1', 'שם ישוב,כשרים,א\na,1,NaN', 'שם ישוב,כשרים,א\na,1,',
    'שם ישוב,כשרים,א\na,1,1.5']) assert.throws(() => parseLocalities(csv));
});

for (let election = 15; election <= 25; election++) test(`parses actual election ${election} source, aggregates localities and keeps metadata out of parties`, () => {
  const csv = readFileSync(new URL(`../../public/data/${election}/elections.csv`, import.meta.url), 'utf8');
  const localities = parseLocalities(csv);
  assert.ok(localities.length > 1000);
  assert.equal(new Set(localities.map(row => row.id)).size, localities.length);
  assert.ok(localities.every(row => row.validVotes > 0 && !row.name.includes('מעטפות')));
  for (const row of localities) {
    assert.equal(row.votes['סמל ועדה'], undefined);
    assert.equal(row.votes['ת. עדכון'], undefined);
  }
  const likud = rankLocalities(localities, 'מחל', 'votes');
  assert.ok(likud[0].partyVotes > 10000);
  assert.ok(rankLocalities(localities, 'מחל', 'percentage').every(row => row.percentage <= 100));
});

test('station identities retain locality, fractional numbers and split stations', () => {
  const csv = 'שם ישוב,סמל ישוב,מספר קלפי,פיצול,כשרים,א,ב,ברזל,ריכוז,שופט,קלפי\nעיר א,1,0001.0,0,100,60,40,0,0,0,0\nעיר א,1,1.0,1,20,5,15,0,0,0,0\nעיר א,1,1.1,0,10,9,1,0,0,0,0\nעיר ב,2,1,0,50,20,30,0,0,0,0\nמעטפות כפולות,9999,1,0,50,40,10,0,0,0,0\nעיר א,1,2,0,0,0,0,0,0,0,0\n';
  const stations = parsePollingStations(csv);
  assert.equal(stations.length, 4);
  assert.equal(new Set(stations.map(row => row.id)).size, 4);
  assert.deepEqual(stations.map(row => row.pollingStation), ['1', '1', '1.1', '1']);
  assert.deepEqual(stations.map(row => row.split), [0, 1, 0, 0]);
  assert.deepEqual(rankLocalities(stations, 'א', 'votes').map(row => row.partyVotes), [60, 20, 9, 5]);
  assert.equal(rankLocalities(stations, 'א', 'percentage')[0].percentage, 90);
  assert.equal(rankLocalities(stations, 'א', 'percentage', 30).length, 2);
  assert.deepEqual(Object.keys(stations[0].votes), ['א', 'ב']);
});

test('station parser supports locality names without codes and rejects missing or invalid station identifiers', () => {
  const stations = parsePollingStations('שם ישוב,סמל קלפי,כשרים,א\nא,01,5,5\nא,1,3,3\nב,1,10,10');
  assert.equal(stations.length, 2);
  assert.equal(stations[0].validVotes, 8);
  assert.notEqual(stations[0].id, stations[1].id);
  for (const csv of ['שם ישוב,כשרים,א\nא,10,1', ...['', '0', '-1', 'NaN'].map(number => `שם ישוב,מספר קלפי,כשרים,א\nא,${number},10,1`)]) {
    assert.throws(() => parsePollingStations(csv));
  }
});

for (let election = 15; election <= 19; election++) test(`election ${election} station totals match locality aggregation`, () => {
  const csv = readFileSync(new URL(`../../public/data/${election}/elections.csv`, import.meta.url), 'utf8');
  const localities = parseLocalities(csv);
  const stations = parsePollingStations(csv);
  assert.ok(stations.length > 6000);
  const totals = (rows: typeof localities) => rows.reduce((sum, row) => sum + row.validVotes, 0);
  assert.equal(totals(stations), totals(localities));
  const grouped = new Map<string, number>();
  for (const station of stations) grouped.set(station.name, (grouped.get(station.name) ?? 0) + station.validVotes);
  assert.equal(grouped.size, localities.length);
  for (const locality of localities) assert.equal(grouped.get(locality.name), locality.validVotes);
});

test('station sources use verified historical rows or optional separate archives', () => {
  assert.equal(pollingStationSource('15'), '/data/15/elections.csv');
  assert.equal(pollingStationSource('19'), '/data/19/elections.csv');
  assert.equal(pollingStationSource('20'), '/data/20/polling-stations.csv');
  assert.equal(pollingStationSource('26'), '/data/26/polling-stations.csv');
  assert.equal(pollingStationSource('14'), null);
  assert.equal(hasEmbeddedPollingStations('14'), false);
  assert.equal(hasEmbeddedPollingStations('19'), true);
  assert.equal(hasEmbeddedPollingStations('20'), false);
});


test('parses the official election 26 קלפי header and excludes all CSV metadata', () => {
  const csv = readFileSync(new URL('./fixtures/election26-polling-stations.csv', import.meta.url), 'utf8');
  const stations = parsePollingStations(csv);
  assert.equal(stations.length, 3);
  assert.deepEqual(stations.map(row => row.pollingStation), ['1', '1.1', '1']);
  assert.equal(new Set(stations.map(row => row.id)).size, 3);
  assert.equal(stations.reduce((sum, row) => sum + row.validVotes, 0), 300);
  assert.equal(rankLocalities(stations, 'מחל', 'percentage')[0].percentage, 70);
  for (const row of stations) for (const key of ['קלפי', 'ברזל', 'ריכוז', 'שופט', 'חיצוניות', 'קלפי אחרת']) assert.equal(row.votes[key], undefined);
});
