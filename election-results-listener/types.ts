export interface PartyData {
  votes: number
  mandats?: number;
}

export type VoteData = Record<string, PartyData>
export type ResultsData = Record<string, Required<PartyData>>

export interface ElectionsConfig {
  algorithm: string;
  blockPercentage: number;
  agreements: string[][];
  csvUrl?: string;
  pollingStationsCsvUrl?: string;
  voteData?: VoteData;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isVoteData(value: unknown): value is VoteData {
  return isRecord(value) && Object.values(value).every(party =>
    isRecord(party) && typeof party.votes === 'number' && Number.isFinite(party.votes)
    && (party.mandats === undefined || typeof party.mandats === 'number'),
  );
}
