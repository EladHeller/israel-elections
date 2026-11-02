import { useEffect, useState } from 'react';
import { hasEmbeddedPollingStations, hasLocalityData, pollingStationSource } from '../lib/locality-availability';
import { parseLocalities, parsePollingStations, type LocalityVotes } from '../lib/party-research';

interface Snapshot {
  election: string;
  localities: LocalityVotes[];
  stations: LocalityVotes[];
  updated: string | null;
}

export function useLocalityResults(election: string, counting: boolean) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const supported = hasLocalityData(election);
  useEffect(() => {
    setError(false);
    if (!supported) return;
    const controller = new AbortController();
    let inFlight = false;
    const read = async (url: string) => {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('CSV unavailable');
      return { csv: await response.text(), modified: response.headers.get('last-modified') };
    };
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const embedded = hasEmbeddedPollingStations(election);
        const optionalStations = embedded ? Promise.resolve(null)
          : read(pollingStationSource(election)!).then(source => parsePollingStations(source.csv)).catch(() => null);
        const [source, stations] = await Promise.all([read(`/data/${election}/elections.csv`), optionalStations]);
        const localities = parseLocalities(source.csv);
        const parsedStations = embedded ? parsePollingStations(source.csv) : stations;
        if (controller.signal.aborted) return;
        setSnapshot(previous => ({
          election, localities,
          stations: parsedStations ?? (previous?.election === election ? previous.stations : []),
          updated: source.modified && Number.isFinite(Date.parse(source.modified)) ? source.modified : null,
        }));
        setError(false);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally { inFlight = false; }
    };
    void load();
    const interval = counting ? window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 30_000) : undefined;
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [election, counting, supported, attempt]);

  return { data: snapshot?.election === election ? snapshot : null, error, retry: () => setAttempt(value => value + 1) };
}
