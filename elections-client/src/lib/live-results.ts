import type { ElectionPhase, ElectionResultsPayload } from '../types';

export const LIVE_RESULTS_REFRESH_INTERVAL_MS = 30_000;

export const shouldRefreshLiveResults = (
  phase: ElectionPhase,
  visibilityState: DocumentVisibilityState,
): boolean => phase === 'counting' && visibilityState === 'visible';

export const resultSnapshotsDiffer = (
  previous: ElectionResultsPayload,
  next: ElectionResultsPayload,
): boolean =>
  previous.time !== next.time ||
  JSON.stringify(previous.voteData) !== JSON.stringify(next.voteData) ||
  JSON.stringify(previous.realResults) !== JSON.stringify(next.realResults);

export interface ResultChange {
  party: string;
  seats: number;
  delta: number;
  threshold: 'entered' | 'left' | null;
}

export const getResultChanges = (
  previous: ElectionResultsPayload, next: ElectionResultsPayload, blockPercentage: number,
): ResultChange[] => {
  const total = (snapshot: ElectionResultsPayload) => Object.values(snapshot.voteData)
    .reduce((sum, entry) => sum + entry.votes, 0);
  const previousTotal = total(previous);
  const nextTotal = total(next);
  const passed = (votes: number, sum: number) => votes > 0 && sum > 0 && votes >= Math.ceil(sum * blockPercentage);
  const parties = new Set([...Object.keys(previous.voteData), ...Object.keys(next.voteData)]);
  return [...parties].flatMap((party): ResultChange[] => {
    const seats = next.realResults[party]?.mandats || 0;
    const delta = seats - (previous.realResults[party]?.mandats || 0);
    const wasAbove = passed(previous.voteData[party]?.votes || 0, previousTotal);
    const isAbove = passed(next.voteData[party]?.votes || 0, nextTotal);
    const threshold = blockPercentage > 0 && wasAbove !== isAbove ? (isAbove ? 'entered' : 'left') : null;
    return delta || threshold ? [{ party, seats, delta, threshold }] : [];
  }).sort((a, b) => Number(!!b.threshold) - Number(!!a.threshold) || Math.abs(b.delta) - Math.abs(a.delta));
};
