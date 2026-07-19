import { useEffect, useMemo, useState } from 'react';
import blocsConfigAll from '../data/blocs.json';
import electionsConfigAll from '../data/elections-config.json';
import electionsManifestsAll from '../data/elections-manifests.json';
import partyNamesAll from '../data/party-names.json';
import { detectAvailableElections, fetchElectionResults } from '../lib/data';
import { getDefaultElectionId, phaseHasResults } from '../lib/election-manifest';
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
  const key = electionId ?? '25';
  const all = blocsConfigAll as unknown as Record<string, BlocsConfig>;
  return all[key] || all['25'];
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
  setCurrentElection: (id: string) => void;
  results: ElectionResultsPayload | null;
  error: string | null;
  electionConfig: ElectionConfig;
  blocs: BlocsConfig;
  partyNames: PartyNames;
  electionManifest: ElectionManifest | null;
  isLatestElection: boolean;
}

export const useElectionData = (): UseElectionDataResult => {
  const [availableElections, setAvailableElections] = useState<string[]>([]);
  const [currentElection, setCurrentElection] = useState<string | null>(null);
  const [results, setResults] = useState<ElectionResultsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const configuredElectionIds = Object.keys(electionManifests).map(Number);
        const latestElectionId = Math.max(25, ...configuredElectionIds);
        const available = await detectAvailableElections(latestElectionId);
        setAvailableElections(available);
        setCurrentElection(getDefaultElectionId(available, electionManifests));
      } catch (e) {
        setError((e as Error).message);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!currentElection) return;
    setResults(null);
    setError(null);
    const manifest = getElectionManifest(currentElection);
    if (manifest && !phaseHasResults(manifest.phase)) return;
    const load = async () => {
      try {
        const data = await fetchElectionResults<ElectionResultsPayload>(currentElection);
        setResults(data);
      } catch (e) {
        setError((e as Error).message);
      }
    };
    void load();
  }, [currentElection]);

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
    setCurrentElection,
    results,
    error,
    electionConfig,
    blocs,
    partyNames,
    electionManifest,
    isLatestElection,
  };
};
