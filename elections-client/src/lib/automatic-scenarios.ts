import { calcVotesResults } from './calc';
import { computeBlocMap, computeBlocTotals } from './analytics';
import type { BlocsConfig, ElectionConfig, ResultsMap, VoteData } from '../types';

export const SCENARIO_LIMITS = { partyShare: 0.2, nationalShare: 0.01 };
export interface AutomaticScenario {
  party?: string;
  delta: number;
  threshold?: number;
  seatDeltas: Record<string, number>;
  blocDeltas: Record<string, number>;
  goals: string[];
  distance: number;
  relativeDistance: number;
}
export interface ScenarioAnalysis {
  baseline: ScenarioBaseline;
  votes: AutomaticScenario[];
  thresholds: AutomaticScenario[];
}
export interface ScenarioBaseline {
  seats: Record<string, number>;
  blocs: Record<string, number>;
}
export interface AnalysisInput {
  voteData: VoteData;
  config: ElectionConfig;
  blocs: BlocsConfig;
  partyToBloc?: Record<string, string | null | undefined>;
  party?: string;
}

const calculate = (votes: VoteData, config: ElectionConfig) =>
  calcVotesResults(votes, config.blockPercentage, config.agreements, config.algorithm).realResults;
const differences = (before: Record<string, number>, after: Record<string, number>) =>
  Object.fromEntries([...new Set([...Object.keys(before), ...Object.keys(after)])]
    .map(key => [key, (after[key] || 0) - (before[key] || 0)] as const).filter(([, delta]) => delta));
const seats = (results: ResultsMap) => Object.fromEntries(Object.entries(results).map(([key, data]) => [key, data.mandats]));

/** Include both sides of every floating-point boundary, including exact ties. */
function addBoundary(points: Set<number>, root: number, low: number, high: number) {
  if (!Number.isFinite(root) || root < low - 2 || root > high + 2) return;
  for (let value = Math.floor(root) - 1; value <= Math.floor(root) + 2; value++) {
    if (value >= low && value <= high) points.add(value);
  }
}

/**
 * Bader–Ofer can change only at eligibility, initial quota-floor or quotient ties.
 * Enumerating these boundaries avoids a monotonicity assumption: a partner or
 * an unrelated list can change seats and later change back within the range.
 */
export function voteChangePoints(votes: VoteData, config: ElectionConfig, party: string, limit: number): number[] {
  const low = -limit, high = limit;
  // Largest-remainder elections use a bounded exhaustive scan in the worker.
  if (config.algorithm !== 'baderOffer') return Array.from({ length: 2 * limit + 1 }, (_, i) => i - limit);
  const total = Object.values(votes).reduce((sum, data) => sum + data.votes, 0);
  const threshold = config.blockPercentage;
  const eligibility = new Set([low, high]);
  for (const [key, data] of Object.entries(votes)) {
    const slope = key === party ? 1 : 0;
    addBoundary(eligibility, (threshold * total - data.votes) / (slope - threshold), low, high);
  }
  const points = new Set(eligibility);
  const edges = [...eligibility].sort((a, b) => a - b);
  for (let index = 0; index < edges.length - 1; index++) {
    const start = edges[index], end = edges[index + 1];
    const sample = (start + end) / 2;
    const eligible = Object.entries(votes).filter(([key, data]) => {
      const value = data.votes + (key === party ? sample : 0);
      return value > 0 && value >= threshold * (total + sample);
    });
    const participating = eligible.reduce((sum, [, data]) => sum + data.votes, 0);
    const totalSlope = eligible.some(([key]) => key === party) ? 1 : 0;
    for (const [key, data] of eligible) {
      for (let count = 0; count <= 120; count++) {
        addBoundary(points, (count * participating - 120 * data.votes)
          / (120 * (key === party ? 1 : 0) - count * totalSlope), start, end);
      }
    }
    const rawGroups = new Map(eligible.map(([key, data]) => {
      const slope = key === party ? 1 : 0;
      const atStart = 120 * (data.votes + slope * start) / (participating + totalSlope * start);
      const atEnd = 120 * (data.votes + slope * end) / (participating + totalSlope * end);
      return [key, { value: data.votes, slope,
        minimum: Math.max(1, Math.floor(Math.min(atStart, atEnd)) + 1),
        maximum: Math.min(120, Math.floor(Math.max(atStart, atEnd)) + eligible.length + 1) }];
    }));
    const groups = new Map(rawGroups);
    for (const [a, b] of config.agreements) {
      const first = groups.get(a), second = groups.get(b);
      if (first && second) {
        groups.delete(a); groups.delete(b);
        groups.set(`${a}+${b}`, { value: first.value + second.value, slope: first.slope + second.slope,
          minimum: first.minimum + second.minimum - 1,
          maximum: Math.min(120, first.maximum + second.maximum) });
      }
    }
    // Raw parties cover the inner agreement split; groups cover national allocation.
    for (const collection of [groups, rawGroups]) {
      const changing = [...collection.values()].find(group => group.slope === 1);
      if (!changing) continue;
      for (const fixed of collection.values()) {
        if (fixed.slope || !fixed.value) continue;
        for (let divisor = changing.minimum; divisor <= changing.maximum; divisor++) {
          // (changing.value + delta) / divisor = fixed.value / otherDivisor.
          const minimum = Math.max(fixed.minimum, Math.floor(fixed.value * divisor / (changing.value + end)) - 1);
          const maximum = Math.min(fixed.maximum, Math.ceil(fixed.value * divisor / (changing.value + start)) + 1);
          for (let other = minimum; other <= maximum; other++) {
            addBoundary(points, fixed.value * divisor / other - changing.value, start, end);
          }
        }
      }
    }
  }
  return [...points].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
}

const bucket = (distance: number) => distance <= 0.001 ? 0 : distance <= 0.005 ? 1 : 2;
const priority = (scenario: AutomaticScenario) => scenario.goals.some(goal => goal.startsWith('majority:')) ? 0
  : scenario.goals.some(goal => goal.startsWith('transfer:')) ? 1 : 2;
export const compareScenarios = (a: AutomaticScenario, b: AutomaticScenario) =>
  bucket(a.distance) - bucket(b.distance) || priority(a) - priority(b)
  || Math.abs(a.delta) - Math.abs(b.delta) || a.relativeDistance - b.relativeDistance
  || (a.party || '').localeCompare(b.party || '') || a.delta - b.delta;

export function analyzeScenarios({ voteData, config, blocs, partyToBloc = computeBlocMap(blocs), party }: AnalysisInput): ScenarioAnalysis {
  const total = Object.values(voteData).reduce((sum, data) => sum + data.votes, 0);
  if (!total) return { baseline: { seats: {}, blocs: {} }, votes: [], thresholds: [] };
  const baseline = calculate(voteData, config);
  const baseSeats = seats(baseline);
  const totals = (results: ResultsMap) => computeBlocTotals(results, blocs, Object.fromEntries(Object.entries(partyToBloc).map(([key, bloc]) => [key, bloc ?? null])));
  const baseBlocs = totals(baseline);
  const coalitions = Object.keys(blocs.blocks).map(key => [key]);
  for (const [key, bloc] of Object.entries(blocs.blocks)) {
    if (bloc.complementaryTo && blocs.blocks[bloc.complementaryTo]) coalitions.push([bloc.complementaryTo, key]);
  }
  const summarize = (result: ResultsMap): Pick<AutomaticScenario, 'seatDeltas' | 'blocDeltas' | 'goals'> => {
    const nextBlocs = totals(result);
    const seatDeltas = differences(baseSeats, seats(result));
    const blocDeltas = differences(baseBlocs, nextBlocs);
    const goals: string[] = [];
    for (const [loser, change] of Object.entries(blocDeltas)) if (change < 0) {
      for (const [winner, gain] of Object.entries(blocDeltas)) if (gain > 0) goals.push(`transfer:${loser}:${winner}`);
    }
    for (const coalition of coalitions) {
      const before = coalition.reduce((sum, key) => sum + baseBlocs[key], 0);
      const after = coalition.reduce((sum, key) => sum + nextBlocs[key], 0);
      if ((before >= 61) !== (after >= 61)) goals.push(`majority:${coalition.join('+')}:${after >= 61 ? 'gain' : 'lose'}`);
    }
    if (party && seatDeltas[party]) goals.push(`party:${seatDeltas[party] > 0 ? 'gain' : 'lose'}`);
    return { seatDeltas, blocDeltas, goals };
  };
  const nearest = new Map<string, AutomaticScenario>();
  for (const [key, data] of Object.entries(voteData)) {
    if (party && key !== party) continue;
    const limit = Math.floor(Math.min(data.votes * SCENARIO_LIMITS.partyShare, total * SCENARIO_LIMITS.nationalShare));
    if (!limit) continue;
    for (const delta of voteChangePoints(voteData, config, key, limit)) {
      if (!delta) continue;
      const summary = summarize(calculate({ ...voteData, [key]: { ...data, votes: data.votes + delta } }, config));
      if (!summary.goals.length) continue;
      const scenario: AutomaticScenario = { party: key, delta, ...summary,
        distance: Math.abs(delta) / total, relativeDistance: Math.abs(delta) / data.votes };
      for (const goal of summary.goals) {
        const goalKey = goal;
        const previous = nearest.get(goalKey);
        if (!previous || Math.abs(delta) < Math.abs(previous.delta)
          || (Math.abs(delta) === Math.abs(previous.delta) && compareScenarios(scenario, previous) < 0)) nearest.set(goalKey, scenario);
      }
    }
  }
  const candidates = [...new Set(nearest.values())].sort(compareScenarios);
  // Threshold scenarios use the simulator's 0.01 percentage-point resolution.
  const thresholds = new Set([0]);
  for (const data of Object.values(voteData)) {
    const boundary = data.votes / total * 10_000;
    thresholds.add(Math.floor(boundary) / 10_000);
    thresholds.add((Math.floor(boundary) + 1) / 10_000);
  }
  const thresholdScenarios: AutomaticScenario[] = [];
  for (const threshold of thresholds) {
    if (threshold === config.blockPercentage || threshold > 1) continue;
    const thresholdResult = calculate(voteData, { ...config, blockPercentage: threshold });
    if (!Object.keys(thresholdResult).length) continue;
    const summary = summarize(thresholdResult);
    if (!Object.keys(summary.seatDeltas).length || (threshold !== 0 && !Object.keys(summary.blocDeltas).length)) continue;
    thresholdScenarios.push({ delta: 0, threshold, ...summary, distance: 0, relativeDistance: 0 });
  }
  thresholdScenarios.sort((a, b) => Math.abs(a.threshold! - config.blockPercentage) - Math.abs(b.threshold! - config.blockPercentage));
  const closest = thresholdScenarios[0];
  const noThreshold = thresholdScenarios.find(item => item.threshold === 0);
  return {
    baseline: { seats: baseSeats, blocs: baseBlocs },
    votes: candidates,
    thresholds: [...new Set([closest, noThreshold].filter((item): item is AutomaticScenario => !!item))],
  };
}

export function selectScenarios(analysis: ScenarioAnalysis, partyView = false): AutomaticScenario[] {
  const thresholdCount = Math.min(2, analysis.thresholds.length);
  return [...analysis.votes.slice(0, (partyView ? 8 : 5) - thresholdCount), ...analysis.thresholds];
}
