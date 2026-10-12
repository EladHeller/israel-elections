import { calcVotesResults } from './calc';
import { phaseHasResults } from './election-manifest';
import manifests from '../data/elections-manifests.json';
import type { ElectionConfig, ElectionPhase, VoteData } from '../types';

export const canPreviewElectionDemo = (
  election: string | null, phase: ElectionPhase | undefined, isLatestElection: boolean,
): boolean => election === '26' && isLatestElection && !!phase && !phaseHasResults(phase);

// Invented numbers for the preview only. Never use this as a results-fetch fallback.
const sampleVotes: Record<string, number> = {
  'מחל': 800000, 'רק': 1150000, 'שס': 310000, 'ג': 270000,
  'ט': 210000, 'ב': 320000, 'ך': 155000, 'ל': 270000,
  'דרך': 220000, 'אמת': 250000, 'עם': 175000, 'ודם': 195000,
  'כן': 142000,
};
const voteData: VoteData = Object.fromEntries(manifests['26'].lists.map((list) => [
  list.ballotLetter,
  { name: list.name, votes: sampleVotes[list.ballotLetter] ?? 500, mandats: 0 },
]));
const previousVoteData: VoteData = structuredClone(voteData);
previousVoteData['מחל'].votes -= 70000;
previousVoteData['רק'].votes -= 10000;
previousVoteData['כן'].votes -= 18000;

export const electionDemoConfig: ElectionConfig = {
  algorithm: 'baderOffer',
  blockPercentage: 0.0325,
  agreements: [],
  turnoutPercentage: 64.2,
  totalVotes: Object.values(voteData).reduce((sum, party) => sum + party.votes, 0) + 23000,
};

export const electionDemo = {
  current: calcVotesResults(voteData, 0.0325, [], 'baderOffer'),
  previous: calcVotesResults(previousVoteData, 0.0325, [], 'baderOffer'),
};
