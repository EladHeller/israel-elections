import { calcVotesResults } from './calc';
import type { ElectionConfig, VoteData } from '../types';
import type { LocalityVotes } from './party-research';

export function localityId(row: LocalityVotes): string {
  return row.pollingStation ? JSON.parse(row.id)[0] : row.id;
}

export function localityHref(election: string, row: LocalityVotes): string {
  const query = new URLSearchParams({ locality: localityId(row) });
  if (row.pollingStation) query.set('station', row.id);
  return `/localities/${election}?${query}`;
}

export function stationLabel(row: LocalityVotes): string {
  return `קלפי ${row.pollingStation}${row.split ? ` (פיצול ${row.split})` : ''}`;
}

export function localResults(row: LocalityVotes, config: ElectionConfig) {
  const votes: VoteData = Object.fromEntries(Object.entries(row.votes)
    .map(([party, count]) => [party, { votes: count, mandats: 0 }]));
  return calcVotesResults(votes, config.blockPercentage, config.agreements, config.algorithm).realResults;
}
