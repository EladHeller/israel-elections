export type Algorithm = 'baderOffer' | 'ceilRound';

export interface PartyVotes {
  votes: number;
  mandats: number;
  name?: string;
}

export type VoteData = Record<string, PartyVotes>;

export interface PartyResult {
  votes: number;
  mandats: number;
}

export type ResultsMap = Record<string, PartyResult>;

export interface ElectionConfig {
  blockPercentage: number;
  agreements: [string, string][];
  algorithm: Algorithm;
  turnoutPercentage?: number;
  totalVotes?: number;
  finalResults?: boolean;
}

export interface BlocsConfig {
  blocks: Record<string, { label: string; color: string; parties: string[] }>;
  order?: string[];
}

export type PartyNames = Record<string, string>;

export interface ElectionResultsPayload {
  time?: string;
  voteData: VoteData;
  realResults: ResultsMap;
  withoutAgreements?: ResultsMap;
  beforeBaderOffer?: ResultsMap;
  afterBaderOffer?: ResultsMap;
}

export interface ScenarioState {
  voteData: VoteData;
  config: ElectionConfig;
}

export interface AgreementValidation {
  isValid: boolean;
  errors: string[];
}

