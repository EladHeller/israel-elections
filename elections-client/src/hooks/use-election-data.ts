import { useEffect, useMemo, useState } from 'react';
import blocsConfigAll from '../data/blocs.json';
import { getElectionBlocs } from '../lib/bloc-preferences';
import electionsConfigAll from '../data/elections-config.json';
import electionsManifestsAll from '../data/elections-manifests.json';
import partyNamesAll from '../data/party-names.json';
import { detectAvailableElections, fetchElectionResults, LATEST_ELECTION_ID } from '../lib/data';
import { getDefaultElectionId, phaseHasResults } from '../lib/election-manifest';
import { fetchCountingEstimate } from '../lib/counting-progress';
import { excludeWithdrawnLists } from '../lib/withdrawn-lists';
import {
  LIVE_RESULTS_REFRESH_INTERVAL_MS,
  resultSnapshotsDiffer,
  shouldRefreshLiveResults,
} from '../lib/live-results';
import type {
  BlocsConfig,
  ElectionConfig,
  ElectionManifest,
  ElectionResultsPayload,
  PartyNames,
} from '../types';

const electionManifests = electionsManifestsAll as unknown as Record<
  string,
  ElectionManifest
>;

const getElectionConfig = (electionId: string | null): ElectionConfig => {
  if (!electionId) {
    return {
      blockPercentage: 0.0325,
      agreements: [],
      algorithm: 'baderOffer',
    };
  }
  const raw = (electionsConfigAll as unknown as Record<string, ElectionConfig>)[electionId];
  return (
    raw || {
      blockPercentage: 0.0325,
      agreements: [],
      algorithm: 'baderOffer',
    }
  );
};

const getBlocConfig = (electionId: string | null): BlocsConfig => {
  return getElectionBlocs(blocsConfigAll as Record<string, BlocsConfig>, electionId);
};

const getPartyNames = (electionId: string | null): PartyNames => {
  const all = partyNamesAll as unknown as Record<string, PartyNames>;
  if (!electionId) return {};
  return all[electionId] || {};
};

const getElectionManifest = (electionId: string | null): ElectionManifest | null => {
  if (!electionId) return null;
  return electionManifests[electionId] || {
    phase: 'final',
    lists: [],
  };
};

export interface UseElectionDataResult {
  availableElections: string[];
  currentElection: string | null;
  results: ElectionResultsPayload | null;
  previousResults: ElectionResultsPayload | null;
  error: string | null;
  refreshError: string | null;
  electionConfig: ElectionConfig;
  countingTotalVotes?: number;
  blocs: BlocsConfig;
  partyNames: PartyNames;
  electionManifest: ElectionManifest | null;
  isLatestElection: boolean;
}

export const useElectionData = (requestedElection?: string, loadResults = true): UseElectionDataResult => {
  const [availableElections, setAvailableElections] = useState<string[]>([]);
  const currentElection = requestedElection === undefined
    ? getDefaultElectionId(availableElections, electionManifests)
    : availableElections.includes(requestedElection) ? requestedElection : null;
  const [results, setResults] = useState<ElectionResultsPayload | null>(null);
  const [previousResults, setPreviousResults] =
    useState<ElectionResultsPayload | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countingEstimate, setCountingEstimate] = useState<{ election: string; totalVotes?: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const configuredElectionIds = Object.keys(electionManifests).map(Number);
        const latestElectionId = Math.max(LATEST_ELECTION_ID, ...configuredElectionIds);
        const available = await detectAvailableElections(latestElectionId);
        setAvailableElections(available);
      } catch (e) {
        setError((e as Error).message);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!currentElection || !loadResults) return;
    setResults(null);
    setPreviousResults(null);
    setError(null);
    setRefreshError(null);
    const manifest = getElectionManifest(currentElection);
    if (manifest && !phaseHasResults(manifest.phase)) return;

    let cancelled = false;
    let requestInFlight = false;
    let hasLoadedResults = false;
    let lastSuccessfulResults: ElectionResultsPayload | null = null;

    const load = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const [data, estimate] = await Promise.all([
          fetchElectionResults<ElectionResultsPayload>(currentElection)
            .then(data => excludeWithdrawnLists(data, manifest?.withdrawnLists)),
          manifest?.phase === 'counting'
            ? fetchCountingEstimate(currentElection).catch(() => null)
            : Promise.resolve(undefined),
        ]);
        if (cancelled) return;
        if (estimate) {
          setCountingEstimate(previous => previous?.election === currentElection && previous.totalVotes === estimate.totalVotes
            ? previous : { election: currentElection, ...estimate });
        }
        const snapshotChanged =
          !lastSuccessfulResults || resultSnapshotsDiffer(lastSuccessfulResults, data);
        if (lastSuccessfulResults && snapshotChanged) {
          setPreviousResults(lastSuccessfulResults);
        }
        lastSuccessfulResults = data;
        hasLoadedResults = true;
        if (snapshotChanged) {
          setResults(data);
        }
        setError(null);
        setRefreshError(estimate === null ? 'עדכון אומדן המצביעים נכשל. ננסה שוב אוטומטית.' : null);
      } catch (e) {
        if (!cancelled && !hasLoadedResults) {
          setError((e as Error).message);
        } else if (!cancelled) {
          setRefreshError('עדכון התוצאות נכשל. מוצגים הנתונים האחרונים שהתקבלו; ננסה שוב אוטומטית.');
        }
      } finally {
        requestInFlight = false;
      }
    };

    void load();

    if (!manifest || manifest.phase !== 'counting') {
      return () => {
        cancelled = true;
      };
    }

    const refreshIfVisible = () => {
      if (shouldRefreshLiveResults(manifest.phase, document.visibilityState)) {
        void load();
      }
    };
    const intervalId = window.setInterval(
      refreshIfVisible,
      LIVE_RESULTS_REFRESH_INTERVAL_MS,
    );
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [currentElection, loadResults]);

  const electionConfig = useMemo(
    () => getElectionConfig(currentElection),
    [currentElection],
  );
  const blocs = useMemo(() => getBlocConfig(currentElection), [currentElection]);
  const partyNames = useMemo(
    () => getPartyNames(currentElection),
    [currentElection],
  );
  const electionManifest = useMemo(
    () => getElectionManifest(currentElection),
    [currentElection],
  );
  const isLatestElection =
    currentElection != null && availableElections.length > 0
      ? currentElection === availableElections[0]
      : false;
  return {
    availableElections,
    currentElection,
    results,
    previousResults,
    error,
    refreshError,
    electionConfig,
    countingTotalVotes: countingEstimate?.election === currentElection ? countingEstimate.totalVotes : electionConfig.totalVotes,
    blocs,
    partyNames,
    electionManifest,
    isLatestElection,
  };
};
