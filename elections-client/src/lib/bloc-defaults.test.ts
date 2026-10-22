import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import configurations from '../data/blocs.json';
import { computeBlocMap, computeBlocTotals } from './analytics';
import { getElectionBlocs } from './bloc-preferences';
import type { ResultsMap } from '../types';

describe('historical default blocs', () => {
  for (const election of ['21', '22', '23', '24', '25']) {
    it(`assigns every elected party exactly once in Knesset ${election}`, () => {
      const { realResults } = JSON.parse(readFileSync(
        `elections-client/public/data/${election}/allResults.json`, 'utf8',
      )) as { realResults: ResultsMap };
      const blocs = getElectionBlocs(configurations, election);
      const members = Object.values(blocs.blocks).flatMap((bloc) => bloc.parties);
      const elected = Object.keys(realResults).filter((party) => realResults[party].mandats > 0);
      assert.equal(new Set(members).size, members.length, 'no duplicate assignments');
      assert.deepEqual([...members].sort(), elected.sort(), 'only parties that crossed the threshold');
      const totals = computeBlocTotals(realResults, blocs, computeBlocMap(blocs));
      assert.equal(Object.values(totals).reduce((sum, seats) => sum + seats, 0), 120);
    });
  }
});
