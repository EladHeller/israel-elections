import { useEffect, useMemo, useState } from 'react';
import blocsConfigAll from '../data/blocs.json';
import electionsConfigAll from '../data/elections-config.json';
import partyNamesAll from '../data/party-names.json';
import { detectAvailableElections, fetchElectionResults } from '../lib/data.js';

const getElectionConfig = (electionId) => electionsConfigAll[electionId] || {
  blockPercentage: 0.0325,
  agreements: [],
  algorithm: 'baderOffer',
};

const getBlocConfig = (electionId) => blocsConfigAll[electionId] || blocsConfigAll['25'];

const getPartyNames = (electionId) => partyNamesAll[electionId] || {};

export const useElectionData = () => {
  const [availableElections, setAvailableElections] = useState([]);
  const [currentElection, setCurrentElection] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const available = await detectAvailableElections();
        setAvailableElections(available);
        setCurrentElection(available[0]);
      } catch (e) {
        setError(e.message);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!currentElection) return;
    setResults(null);
    const load = async () => {
      try {
        const data = await fetchElectionResults(currentElection);
        setResults(data);
      } catch (e) {
        setError(e.message);
      }
    };
    load();
  }, [currentElection]);

  const electionConfig = useMemo(() => getElectionConfig(currentElection), [currentElection]);
  const blocs = useMemo(() => getBlocConfig(currentElection), [currentElection]);
  const partyNames = useMemo(() => getPartyNames(currentElection), [currentElection]);
  const isLatestElection = currentElection === availableElections[0];
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
