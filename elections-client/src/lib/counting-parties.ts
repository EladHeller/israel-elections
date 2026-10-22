import type { ElectionList, ResultsMap, VoteData } from '../types';

/** Keep registered lists available, including when the user expands the results. */
export const getCountingParties = (votes: VoteData, results: ResultsMap, lists: ElectionList[]) => {
  const parties = new Set([...lists.map(list => list.ballotLetter), ...Object.keys(votes)]);
  return [...parties]
    .filter(party => !['﻿סמל ועדה', 'סמל ועדה'].includes(party))
    .map(party => ({ party, votes: votes[party]?.votes || 0, mandats: results[party]?.mandats || 0 }))
    .sort((a, b) => b.mandats - a.mandats || b.votes - a.votes);
};

export const getPartyFilterState = (showAllParties: boolean, awaitingResults: boolean) => ({
  showAllParties: awaitingResults || showAllParties,
  hidePartyFilter: awaitingResults,
});

