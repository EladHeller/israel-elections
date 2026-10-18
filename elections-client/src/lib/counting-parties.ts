import type { ElectionList, ResultsMap, VoteData } from '../types';

/** Keep every registered list visible while the first ballots arrive. */
export const getCountingParties = (votes: VoteData, results: ResultsMap, lists: ElectionList[]) => {
  const parties = new Set([...lists.map(list => list.ballotLetter), ...Object.keys(votes)]);
  return [...parties]
    .filter(party => !['﻿סמל ועדה', 'סמל ועדה'].includes(party))
    .map(party => ({ party, votes: votes[party]?.votes || 0, mandats: results[party]?.mandats || 0 }))
    .sort((a, b) => b.mandats - a.mandats || b.votes - a.votes);
};
