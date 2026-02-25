import { calcVotesResults, type CalcVoteData } from './calc';
import type { ResultsMap, VoteData, ElectionConfig, BlocsConfig } from '../types';

export const computeBlocMap = (blocsConfig: BlocsConfig): Record<string, string> => {
  const partyToBloc: Record<string, string> = {};
  Object.entries(blocsConfig.blocks).forEach(([blocKey, bloc]) => {
    bloc.parties.forEach((party) => {
      partyToBloc[party] = blocKey;
    });
  });
  return partyToBloc;
};

export const computeBlocTotals = (
  results: ResultsMap,
  blocsConfig: BlocsConfig,
  partyToBlocOverride?: Record<string, string | null>,
): Record<string, number> => {
  const partyToBloc = partyToBlocOverride || computeBlocMap(blocsConfig);
  const totals: Record<string, number> = {};

  Object.keys(blocsConfig.blocks).forEach((blocKey) => {
    totals[blocKey] = 0;
  });

  Object.entries(results).forEach(([party, { mandats }]) => {
    const blocKey = partyToBloc[party];
    if (!blocKey || !(blocKey in totals)) return;
    totals[blocKey] += mandats;
  });

  return totals;
};

const hasSeatChange = (
  voteData: CalcVoteData,
  config: Pick<ElectionConfig, 'blockPercentage' | 'agreements' | 'algorithm'>,
  party: string,
  delta: number,
): number => {
  const current = voteData[party];
  if (!current) return 0;
  const nextVoteData: VoteData = {
    ...voteData,
    [party]: { ...current, votes: current.votes + delta },
  };
  const next = calcVotesResults(
    nextVoteData,
    config.blockPercentage,
    config.agreements,
    config.algorithm,
  );
  return next.realResults[party]?.mandats || 0;
};

const findGainMargin = (
  voteData: CalcVoteData,
  config: Pick<ElectionConfig, 'blockPercentage' | 'agreements' | 'algorithm'>,
  party: string,
  currentSeats: number,
  sumVotes: number,
): number | null => {
  const maxDelta = sumVotes;
  const seatsAtMax = hasSeatChange(voteData, config, party, maxDelta);
  if (seatsAtMax <= currentSeats) return null;

  let low = 0;
  let high = maxDelta;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    const seatsAtMid = hasSeatChange(voteData, config, party, mid);
    if (seatsAtMid > currentSeats) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return high;
};

const findLoseMargin = (
  voteData: VoteData,
  config: Pick<ElectionConfig, 'blockPercentage' | 'agreements' | 'algorithm'>,
  party: string,
  currentSeats: number,
): number | null => {
  const current = voteData[party];
  if (!current) return null;
  const maxDelta = current.votes;
  const seatsAtMax = hasSeatChange(voteData, config, party, -maxDelta);
  if (seatsAtMax >= currentSeats) return null;

  let low = 0;
  let high = maxDelta;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    const seatsAtMid = hasSeatChange(voteData, config, party, -mid);
    if (seatsAtMid < currentSeats) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return high;
};

export interface SeatMargin {
  party: string;
  mandats: number;
  gain: number | null;
  lose: number | null;
}

export const computeSeatMargins = (
  results: ResultsMap,
  voteData: VoteData,
  config: Pick<ElectionConfig, 'blockPercentage' | 'agreements' | 'algorithm'>,
): SeatMargin[] => {
  const sumVotes = Object.values(voteData).reduce((acc, { votes }) => acc + votes, 0);
  const margins = Object.entries(results).map(([party, { mandats }]) => {
    const gain = findGainMargin(voteData, config, party, mandats, sumVotes);
    const lose = findLoseMargin(voteData, config, party, mandats);
    return {
      party,
      mandats,
      gain,
      lose,
    };
  });
  return margins;
};

