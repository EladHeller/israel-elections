import { calcVotesResults, sumBy } from './calc';
import { getCountingProgress } from './counting-progress';
import type { ElectionConfig, ElectionResultsPayload, ResultsMap, VoteData } from '../types';

type Settings = Pick<ElectionConfig, 'blockPercentage' | 'agreements' | 'algorithm'>;

/** The turnout total includes invalid ballots; extrapolate the observed valid fraction. */
export const estimateRemainingValidVotes = (
  results: ElectionResultsPayload, totalVotes: number | undefined, isCounting: boolean,
): number | null => {
  const progress = getCountingProgress(results, totalVotes);
  if (!isCounting || progress.percentage === null || progress.percentage < 85
    || progress.percentage >= 100) return null;
  const validVotes = sumBy(Object.values(results.voteData), 'votes');
  const remaining = Math.floor((totalVotes! - progress.countedVotes) * validVotes / progress.countedVotes);
  return remaining > 0 ? remaining : null;
};

/** Keep the modeled ratios exact; fractional allocations are not real counted ballots. */
export const projectRemainingVotes = (
  voteData: VoteData, party: string, gainVotes: number, remainingVotes: number,
): VoteData => {
  const otherTotal = sumBy(Object.entries(voteData).filter(([key]) => key !== party)
    .map(([, data]) => data), 'votes');
  return Object.fromEntries(Object.entries(voteData).map(([key, data]) => [key, {
    ...data, votes: data.votes + (key === party ? gainVotes
      : otherTotal > 0 ? (remainingVotes - gainVotes) * data.votes / otherTotal : 0),
  }]));
};

export interface RemainingSeatRace {
  party: string;
  currentShare: number;
  requiredShare: number | null;
  requiredVotes: number | null;
}

interface LinearVotes { start: number; slope: number }
const add = (a: LinearVotes, b: LinearVotes): LinearVotes => ({
  start: a.start + b.start, slope: a.slope + b.slope,
});

/** Largest-remainder rounding is not monotonic. Check every possible rounding transition. */
const roundingCandidates = (voteData: VoteData, party: string, remaining: number, threshold: number) => {
  const total = sumBy(Object.values(voteData), 'votes');
  const otherTotal = total - voteData[party].votes;
  const lines: Record<string, LinearVotes> = Object.fromEntries(Object.entries(voteData).map(([key, data]) => [key,
    key === party ? { start: data.votes, slope: 1 }
      : { start: data.votes * (1 + remaining / otherTotal), slope: -data.votes / otherTotal },
  ]));
  const candidates = new Set([0, remaining]);
  const addRoot = (start: number, slope: number, min = 0, max = remaining) => {
    if (Math.abs(slope) < 1e-12) return;
    const root = -start / slope;
    if (root < min || root > max) return;
    // Check both sides and exact integer ties despite floating-point root error.
    for (let x = Math.floor(root) - 1; x <= Math.ceil(root) + 1; x++) {
      if (x >= 0 && x <= remaining) candidates.add(x);
    }
  };
  const cuts = [0, remaining];
  for (const line of Object.values(lines)) {
    const root = (threshold * (total + remaining) - line.start) / line.slope;
    if (root > 0 && root < remaining) cuts.push(root);
    addRoot(line.start - threshold * (total + remaining), line.slope);
  }
  return { lines, candidates, cuts: cuts.sort((a, b) => a - b), addRoot };
};

const findRoundedGain = (voteData: VoteData, party: string, config: Settings, remaining: number,
  gainsSeat: (votes: number) => boolean): number | null => {
  if (sumBy(Object.values(voteData), 'votes') === voteData[party].votes) return null;
  const { lines, candidates, cuts, addRoot } = roundingCandidates(voteData, party, remaining, config.blockPercentage);
  for (let i = 1; i < cuts.length; i++) {
    const min = cuts[i - 1], max = cuts[i], midpoint = (min + max) / 2;
    const total = sumBy(Object.values(voteData), 'votes') + remaining;
    const passing = Object.fromEntries(Object.entries(lines).filter(([, line]) =>
      line.start + midpoint * line.slope >= total * config.blockPercentage
      && line.start + midpoint * line.slope > 0));
    const quotaTotal = Object.values(passing).reduce(add, { start: 0, slope: 0 });
    const groups = { ...passing };
    for (const [a, b] of config.agreements) {
      if (!(a in groups && b in groups)) continue;
      const pair = add(groups[a], groups[b]);
      groups[`${a}+${b}`] = pair;
      delete groups[a]; delete groups[b];
      // The final agreement can receive any number of seats. Its two remainders
      // change order only at half-integer multiples of the agreement quota.
      for (let seats = 1; seats <= 120; seats++) {
        for (let k = 0; k <= 2 * seats; k++) {
          addRoot(seats * passing[a].start - k / 2 * pair.start,
            seats * passing[a].slope - k / 2 * pair.slope, min, max);
        }
      }
    }
    for (const line of [...Object.values(passing), ...Object.values(groups)]) {
      for (let seats = 0; seats <= 120; seats++) {
        addRoot(120 * line.start - seats * quotaTotal.start,
          120 * line.slope - seats * quotaTotal.slope, min, max);
      }
    }
    const grouped = Object.values(groups);
    for (let a = 0; a < grouped.length; a++) for (let b = a + 1; b < grouped.length; b++) {
      for (let difference = -120; difference <= 120; difference++) {
        addRoot(120 * (grouped[a].start - grouped[b].start) - difference * quotaTotal.start,
          120 * (grouped[a].slope - grouped[b].slope) - difference * quotaTotal.slope, min, max);
      }
    }
  }
  return [...candidates].sort((a, b) => a - b).find(gainsSeat) ?? null;
};

export const computeRemainingSeatRaces = (
  results: ResultsMap, voteData: VoteData, config: Settings, remainingVotes: number,
): RemainingSeatRace[] => {
  const total = sumBy(Object.values(voteData), 'votes');
  if (total <= 0 || !Number.isSafeInteger(remainingVotes) || remainingVotes <= 0) return [];
  return Object.entries(voteData).filter(([, data]) => data.votes > 0).map(([party, data]) => {
    const seats = results[party]?.mandats ?? 0;
    const gainsSeat = (votes: number) => {
      const projected = projectRemainingVotes(voteData, party, votes, remainingVotes);
      return (calcVotesResults(projected, config.blockPercentage, config.agreements,
        config.algorithm).realResults[party]?.mandats ?? 0) > seats;
    };
    let requiredVotes: number | null = null;
    if (config.algorithm === 'ceilRound') {
      requiredVotes = findRoundedGain(voteData, party, config, remainingVotes, gainsSeat);
    } else if (gainsSeat(remainingVotes)) {
      let low = -1;
      let high = remainingVotes;
      while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        if (gainsSeat(mid)) high = mid;
        else low = mid;
      }
      requiredVotes = high;
    }
    return { party, currentShare: data.votes / total, requiredVotes,
      requiredShare: requiredVotes === null ? null : requiredVotes / remainingVotes };
  }).sort((a, b) => (a.requiredShare ?? Infinity) - (b.requiredShare ?? Infinity));
};
