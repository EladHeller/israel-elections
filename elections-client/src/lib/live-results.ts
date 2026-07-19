import type { ElectionPhase } from '../types';

export const LIVE_RESULTS_REFRESH_INTERVAL_MS = 30_000;

export const shouldRefreshLiveResults = (
  phase: ElectionPhase,
  visibilityState: DocumentVisibilityState,
): boolean => phase === 'counting' && visibilityState === 'visible';
