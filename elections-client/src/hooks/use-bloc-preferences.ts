import { useState } from 'react';
import { computeBlocMap } from '../lib/analytics';
import { BLOC_PREFERENCES_KEY, parseBlocPreferences, type BlocPreferences } from '../lib/bloc-preferences';
import type { BlocsConfig } from '../types';

export const useBlocPreferences = (election: string | null, defaults: BlocsConfig) => {
  const [saved, setSaved] = useState(() => {
    try { return parseBlocPreferences(localStorage.getItem(BLOC_PREFERENCES_KEY)); }
    catch { return {}; }
  });
  const [saveFailed, setSaveFailed] = useState(false);
  const preferences = saved[election || ''];
  const blocs: BlocsConfig = {
    ...defaults,
    blocks: Object.fromEntries(Object.entries(defaults.blocks).map(([key, bloc]) => [
      key, { ...bloc, label: preferences?.labels[key] || bloc.label },
    ])),
  };
  const partyToBloc = {
    ...computeBlocMap(defaults),
    ...Object.fromEntries(Object.entries(preferences?.assignments || {})
      .filter(([, key]) => key === null || Object.hasOwn(defaults.blocks, key))),
  };

  const update = (next: BlocPreferences | null) => {
    if (!election) return;
    const nextSaved = { ...saved };
    if (next) nextSaved[election] = next;
    else delete nextSaved[election];
    setSaved(nextSaved);
    try {
      localStorage.setItem(BLOC_PREFERENCES_KEY, JSON.stringify(nextSaved));
      setSaveFailed(false);
    } catch { setSaveFailed(true); }
  };

  return {
    blocs, partyToBloc, saveFailed,
    customized: !!preferences,
    assignParty: (party: string, key: string | null) => update({
      labels: preferences?.labels || {},
      assignments: { ...preferences?.assignments, [party]: key },
    }),
    renameBloc: (key: string, label: string) => update({
      assignments: preferences?.assignments || {},
      labels: { ...preferences?.labels, [key]: label.trim().slice(0, 40) },
    }),
    reset: () => update(null),
  };
};
