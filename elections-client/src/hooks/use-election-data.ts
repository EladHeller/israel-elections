import { useEffect, useMemo, useState } from 'react';
import blocsConfigAll from '../data/blocs.json';
import electionsConfigAll from '../data/elections-config.json';
import partyNamesAll from '../data/party-names.json';
import { detectAvailableElections, fetchElectionResults } from '../lib/data';
import type {
  BlocsConfig,
  ElectionConfig,
  ElectionResultsPayload,
  PartyNames,
} from '../types';

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

export interface UseElectionDataResult {
  availableElections: string[];
  currentElection: string | null;
  setCurrentElection: (id: string) => void;
  results: ElectionResultsPayload | null;
  error: string | null;
  electionConfig: ElectionConfig;
  blocs: BlocsConfig;
  partyNames: PartyNames;
  isLatestElection: boolean;
  hasFinalResults: boolean;
}

export const useElectionData = (): UseElectionDataResult => {
  const [availableElections, setAvailableElections] = useState<string[]>([]);
  const [currentElection, setCurrentElection] = useState<string | null>(null);
  const [results, setResults] = useState<ElectionResultsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const available = await detectAvailableElections();
        setAvailableElections(available);
        setCurrentElection(available[0] ?? null);
      } catch (e) {
        setError((e as Error).message);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!currentElection) return;
    setResults(null);
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
  const isLatestElection =
    currentElection != null && availableElections.length > 0
      ? currentElection === availableElections[0]
      : false;
  const hasFinalResults = electionConfig.finalResults ?? !isLatestElection;

  return {
    availableElections,
    currentElection,
    setCurrentElection,
    results,
    error,
    electionConfig,
    blocs,
    partyNames,
    isLatestElection,
    hasFinalResults,
  };
};

