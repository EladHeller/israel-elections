import type { AppViewMode } from '../types';

export const DEFAULT_VIEW_MODE: AppViewMode = 'results';

export const viewUsesScenario = (viewMode: AppViewMode): boolean =>
  viewMode === 'simulator';

export const selectViewData = <T>(
  viewMode: AppViewMode,
  baseValue: T,
  scenarioValue: T,
): T => (viewUsesScenario(viewMode) ? scenarioValue : baseValue);
