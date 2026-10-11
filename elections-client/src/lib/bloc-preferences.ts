import type { BlocsConfig } from '../types';

export interface BlocPreferences {
  assignments: Record<string, string | null>;
  labels: Record<string, string>;
}

export const BLOC_PREFERENCES_KEY = 'elections.blocs.v1';

export const parseBlocPreferences = (raw: string | null): Record<string, BlocPreferences> => {
  try {
    const data: unknown = JSON.parse(raw || '{}');
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data).flatMap(([election, value]) => {
      if (!/^\d+$/.test(election) || !value || typeof value !== 'object') return [];
      const { assignments, labels } = value as BlocPreferences;
      if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)
        || !labels || typeof labels !== 'object' || Array.isArray(labels)) return [];
      return [[election, {
        assignments: Object.fromEntries(Object.entries(assignments)
          .filter(([, bloc]) => bloc === null || typeof bloc === 'string')),
        labels: Object.fromEntries(Object.entries(labels)
          .filter(([, label]) => typeof label === 'string' && label.trim().length > 0)
          .map(([key, label]) => [key, label.trim().slice(0, 40)])),
      }]];
    }));
  } catch {
    return {};
  }
};

export const getElectionBlocs = (
  configurations: Record<string, BlocsConfig>, election: string | null,
): BlocsConfig => configurations[election || ''] || {
  order: ['gushA', 'gushB'],
  blocks: {
    gushA: { label: 'גוש א', color: '#2563eb', parties: [] },
    gushB: { label: 'גוש ב', color: '#dc2626', parties: [] },
  },
};
