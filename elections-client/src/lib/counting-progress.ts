import type { ElectionResultsPayload } from '../types';

export const getCountingProgress = (results: ElectionResultsPayload, totalVotes?: number) => {
  const validVotes = Object.values(results.voteData).reduce((sum, party) => sum + party.votes, 0);
  const hasCountedTotal = Number.isSafeInteger(results.countedVotes) && results.countedVotes! >= validVotes;
  const countedVotes = hasCountedTotal ? results.countedVotes! : validVotes;
  const hasEstimate = Number.isSafeInteger(totalVotes) && totalVotes! > 0;
  const estimateExceeded = hasEstimate && countedVotes > totalVotes!;
  const percentage = hasEstimate && !estimateExceeded ? countedVotes / totalVotes! * 100 : null;
  return {
    countedVotes,
    percentage,
    estimateExceeded,
    isEarly: percentage !== null && percentage < 5,
    includesInvalid: hasCountedTotal,
    invalidVotes: hasCountedTotal ? countedVotes - validVotes : undefined,
  };
};

/** Only the denominator is live; calculation settings remain tied to the loaded application. */
export const fetchCountingEstimate = async (electionId: string): Promise<{ totalVotes?: number }> => {
  const response = await fetch('/election-config.json', { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error('Failed to load turnout estimate');
  const config = (await response.json())[electionId];
  if (!config || typeof config !== 'object') throw new Error('Missing election configuration');
  const { totalVotes } = config;
  if (totalVotes !== undefined && (!Number.isSafeInteger(totalVotes) || totalVotes < 0)) {
    throw new Error('Invalid turnout estimate');
  }
  return { totalVotes };
};
