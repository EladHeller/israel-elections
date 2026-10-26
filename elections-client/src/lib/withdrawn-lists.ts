import type { ElectionResultsPayload } from '../types';

/** Official CSVs and old snapshots may still contain withdrawn ballot columns. */
export const excludeWithdrawnLists = (
  results: ElectionResultsPayload, withdrawnLists: string[] = [],
): ElectionResultsPayload => {
  if (!withdrawnLists.length) return results;
  const filtered = { ...results };
  for (const field of ['voteData', 'realResults', 'withoutAgreements', 'beforeBaderOffer', 'afterBaderOffer'] as const) {
    const values = results[field];
    if (values) {
      filtered[field] = Object.fromEntries(Object.entries(values).filter(([letter]) => !withdrawnLists.includes(letter)));
    }
  }
  return filtered;
};
