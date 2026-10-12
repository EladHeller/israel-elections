import { calcVotesResults } from './calc';
import { phaseHasResults } from './election-manifest';
import manifests from '../data/elections-manifests.json';
import electionsConfig from '../data/elections-config.json';
import type { ElectionConfig, ElectionPhase, VoteData } from '../types';

export const canPreviewElectionDemo = (
  election: string | null, phase: ElectionPhase | undefined, isLatestElection: boolean,
): boolean => election === '26' && isLatestElection && !!phase && !phaseHasResults(phase);

// Synthetic votes inspired by i24NEWS (8 October) and Maariv (9 October 2026):
// https://www.i24news.tv/he/news/israel-elections-2026/polls/artc-fa0f56f4
// https://www.walla.co.il/news/politics/383956803
// An illustrative 57 / 51 + 12 scenario, not a published poll or polling average.
// Never use this as a results-fetch fallback.
const sampleVotes: Record<string, number> = {
  'מחל': 805000, 'דרך': 770000, 'רק': 420000, 'אמת': 315000,
  'ל': 280000, 'ב': 315000, 'ג': 280000, 'שס': 245000,
  'ט': 210000, 'ך': 150000, 'ודם': 245000, 'עם': 175000,
  'די': 144000, 'כן': 40000, 'זך': 35000, 'ני': 26000, 'בי': 13000,
};
const voteData: VoteData = Object.fromEntries(manifests['26'].lists.map((list) => [
  list.ballotLetter,
  { name: list.name, votes: sampleVotes[list.ballotLetter] ?? 500, mandats: 0 },
]));
const previousVoteData: VoteData = structuredClone(voteData);
previousVoteData['מחל'].votes -= 50000;
previousVoteData['דרך'].votes -= 10000;
previousVoteData['די'].votes -= 18000;

export const electionDemoConfig: ElectionConfig = {
  ...electionsConfig['26'],
  turnoutPercentage: 64.2,
  totalVotes: Object.values(voteData).reduce((sum, party) => sum + party.votes, 0) + 23000,
};

export const electionDemo = {
  current: calcVotesResults(voteData, electionDemoConfig.blockPercentage, electionDemoConfig.agreements, 'baderOffer'),
  previous: calcVotesResults(previousVoteData, electionDemoConfig.blockPercentage, electionDemoConfig.agreements, 'baderOffer'),
};
