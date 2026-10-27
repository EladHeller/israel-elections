import type { ElectionResultsPayload } from '../types';

export const LATEST_ELECTION_ID = 25;

export const detectAvailableElections = async (
  max: number = LATEST_ELECTION_ID,
  min: number = 1,
): Promise<string[]> => {
  const available: string[] = [];
  for (let i = max; i >= min; i -= 1) {
    available.push(String(i));
  }
  return available;
};

export const fetchElectionResults = async <TResult = unknown>(
  electionId: string,
): Promise<TResult> => {
  const res = await fetch(`/data/${electionId}/allResults.json`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to load data for election ${electionId}`);
  }
  const results: Partial<ElectionResultsPayload> = await res.json();
  const metadataColumns = ['חיצוניות', 'קלפי אחרת'];
  const metadataVotes = metadataColumns.reduce((sum, key) => sum + (results.voteData?.[key]?.votes ?? 0), 0);
  for (const field of ['voteData', 'realResults', 'withoutAgreements', 'beforeBaderOffer', 'afterBaderOffer'] as const) {
    const values = results[field];
    if (values) {
      results[field] = Object.fromEntries(Object.entries(values).filter(([key]) => !metadataColumns.includes(key)));
    }
  }
  if (results.countedVotes !== undefined) results.countedVotes -= metadataVotes;
  return results as TResult;
};

