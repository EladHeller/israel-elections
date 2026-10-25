import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import configurations from '../data/blocs.json';
import validVotes from '../data/elections-valid.json';
import { computeBlocMap, computeBlocTotals } from './analytics';
import { calcVotesResults } from './calc';
import { getElectionBlocs } from './bloc-preferences';
import type { ResultsMap, VoteData } from '../types';

describe('historical default blocs', () => {
  for (const election of Object.keys(configurations)) {
    if (!(election in validVotes)) continue; // No historical results for upcoming elections.
    const { realResults, voteData } = JSON.parse(readFileSync(
      `elections-client/public/data/${election}/allResults.json`, 'utf8',
    )) as { realResults: ResultsMap; voteData: VoteData };
    const blocs = getElectionBlocs(configurations, election);
    const members = Object.values(blocs.blocks).flatMap((bloc) => bloc.parties);
    const { validVotes: total } = validVotes[election as keyof typeof validVotes];

    it(`assigns every party near one seat or above exactly once in Knesset ${election}`, () => {
      // "Around one seat" includes 0.9 seats (0.75% of valid votes), e.g. Economic in 2021.
      const significant = Object.keys(voteData).filter((party) => voteData[party].votes >= total * 0.9 / 120);
      assert.equal(new Set(members).size, members.length, 'no duplicate assignments');
      assert.deepEqual([...members].sort(), significant.sort(), 'include significant below-threshold parties');
      const totals = computeBlocTotals(realResults, blocs, computeBlocMap(blocs));
      assert.equal(Object.values(totals).reduce((sum, seats) => sum + seats, 0), 120);
    });

    it(`keeps all seats assigned when significant parties enter the simulator in Knesset ${election}`, () => {
      const significantVotes = Object.fromEntries(members.map((party) => [party, voteData[party]]));
      const simulated = calcVotesResults(significantVotes, 0.005, [], 'baderOffer').realResults;
      const totals = computeBlocTotals(simulated, blocs);
      assert.equal(Object.values(totals).reduce((sum, seats) => sum + seats, 0), 120);
      for (const party of members) assert.ok(simulated[party]?.mandats > 0);
    });
  }
});
