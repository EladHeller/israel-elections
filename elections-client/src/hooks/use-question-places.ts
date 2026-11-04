import { useEffect, useState } from 'react';
import { hasLocalityData, pollingStationSource } from '../lib/locality-availability';
import { parseLocalities, parsePollingStations, type LocalityVotes } from '../lib/party-research';

const emptyRows: LocalityVotes[] = [];

function usePlaceSource(source: string | null, parse: (text: string) => LocalityVotes[]) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ source: string; rows: LocalityVotes[]; error: boolean }>();
  useEffect(() => {
    if (!source) return;
    const controller = new AbortController();
    void fetch(source, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('load');
      const rows = parse(await response.text()).sort((a, b) => a.name.localeCompare(b.name, 'he') || a.id.localeCompare(b.id));
      if (!controller.signal.aborted) setState({ source, rows, error: false });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ source, rows: [], error: true });
    });
    return () => controller.abort();
  }, [source, parse, attempt]);
  const current = state?.source === source ? state : undefined;
  return { rows: current?.rows ?? emptyRows, loading: !!source && !current, error: !!current?.error,
    retry: () => { setState(undefined); setAttempt(value => value + 1); } };
}

export function useQuestionPlaces(election: string | undefined, stationsNeeded: boolean) {
  const localities = usePlaceSource(election && hasLocalityData(election) ? `/data/${election}/elections.csv` : null, parseLocalities);
  const stations = usePlaceSource(election && stationsNeeded ? pollingStationSource(election) : null, parsePollingStations);
  return { localities: localities.rows, stations: stations.rows, loading: localities.loading || stations.loading,
    error: localities.error || stations.error, retry: () => { localities.retry(); stations.retry(); } };
}
