export interface PartyData {
  votes: number
  mandats?: number;
}

export type VoteData = Record<string, PartyData>
export type ResultsData = Record<string, Required<PartyData>>

export interface ElectionsConfig {
  algorithm: 'baderOffer' | 'ceilRound';
  blockPercentage: number;
  agreements: string[][];
  csvUrl?: string;
  voteData?: VoteData;
}
