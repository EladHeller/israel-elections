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
