import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseLocalities, rankLocalities } from './party-research';
import { hasLocalityData, LOCALITY_ELECTIONS } from './locality-availability';

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
