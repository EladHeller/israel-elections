import { computeSeatMargins, type SeatMargin } from './analytics';
import { filterNotPassBlockPercentage, sumBy } from './calc';
import type { ElectionConfig, ResultsMap, VoteData } from '../types';

// Vote shares are fractions; 0.0025 is 0.25 percentage points.
export const THRESHOLD_PROXIMITY = 0.0025;
export const VERY_CLOSE_THRESHOLD_PROXIMITY = 0.001;
export const SEAT_PROXIMITY = 0.1;

export interface ThresholdRace {
  party: string;
  share: number;
  gapVotes: number;
  gapPercentagePoints: number;
  veryClose: boolean;
}

export interface SeatRace extends SeatMargin {
  loseCrossesThreshold: boolean;
}

export const isCloseSeatMargin = (margin: number | null, limit: number): boolean =>
  margin !== null && margin > 0 && margin <= limit;

export const computeProximity = (
  results: ResultsMap,
  voteData: VoteData,
  config: Pick<ElectionConfig, 'blockPercentage' | 'agreements' | 'algorithm'>,
) => {
  const totalVotes = sumBy(Object.values(voteData), 'votes');
  const threshold = totalVotes * config.blockPercentage;
  const thresholdVotes = Math.ceil(threshold);
  const participatingVotes = sumBy(Object.values(
    filterNotPassBlockPercentage(config.blockPercentage, voteData, totalVotes),
  ), 'votes');
  const votesPerMandate = participatingVotes / 120;
  // An integer vote change must not exceed 10% of the unrounded quota.
  const seatLimit = Math.floor(votesPerMandate * SEAT_PROXIMITY);
  const tolerance = Number.EPSILON * totalVotes * 8;

  const thresholdRaces: ThresholdRace[] = totalVotes > 0 && config.blockPercentage > 0
    ? Object.entries(voteData)
      .filter(([, { votes }]) => votes > 0
        && Math.abs(votes - threshold) <= totalVotes * THRESHOLD_PROXIMITY + tolerance)
      .map(([party, { votes }]) => ({
        party,
        share: votes / totalVotes,
        gapVotes: votes - thresholdVotes,
        gapPercentagePoints: (votes / totalVotes - config.blockPercentage) * 100,
        veryClose: Math.abs(votes - threshold)
          <= totalVotes * VERY_CLOSE_THRESHOLD_PROXIMITY + tolerance,
      }))
      .sort((a, b) => Math.abs(a.gapPercentagePoints) - Math.abs(b.gapPercentagePoints))
    : [];

  const seatRaces: SeatRace[] = computeSeatMargins(results, voteData, config)
    .map((margin) => ({
      ...margin,
      loseCrossesThreshold: config.blockPercentage > 0 && margin.lose !== null
        && voteData[margin.party].votes - margin.lose
          < config.blockPercentage * (totalVotes - margin.lose),
    }))
    .sort((a, b) => Math.min(a.gain ?? Infinity, a.lose ?? Infinity)
      - Math.min(b.gain ?? Infinity, b.lose ?? Infinity));

  const closeSeatRaces = seatRaces.filter(({ gain, lose }) =>
    isCloseSeatMargin(gain, seatLimit) || isCloseSeatMargin(lose, seatLimit));

  return { thresholdRaces, seatRaces, closeSeatRaces, seatLimit, votesPerMandate };
};
