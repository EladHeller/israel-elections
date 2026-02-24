import { useEffect, useMemo, useState } from 'react';
import {
  computeScenarioResults,
  computeSeatDeltas,
  isScenarioEdited,
  normalizeScenarioInput,
  validateAgreements,
} from '../lib/scenario.js';

const NON_PARTY_KEYS = new Set(['﻿סמל ועדה', 'סמל ועדה']);

const cloneConfig = (config) => ({
  algorithm: config.algorithm,
  blockPercentage: config.blockPercentage,
  agreements: (config.agreements || []).map(([a, b]) => [a, b]),
});

const cloneVoteData = (voteData = {}) => Object.fromEntries(
  Object.entries(voteData)
    .filter(([party]) => !NON_PARTY_KEYS.has(party))
    .map(([party, data]) => [party, { votes: data.votes }]),
);

export const useScenario = ({ results, electionConfig, currentElection }) => {
  const [scenarioConfig, setScenarioConfig] = useState(null);
  const [scenarioVoteData, setScenarioVoteData] = useState(null);
  const [addAgreementA, setAddAgreementA] = useState('');
  const [addAgreementB, setAddAgreementB] = useState('');

  const baseVoteData = useMemo(() => cloneVoteData(results?.voteData || {}), [results]);
  const baseConfig = useMemo(() => cloneConfig(electionConfig), [electionConfig]);

  useEffect(() => {
    if (!results) return;
    setScenarioConfig(cloneConfig(electionConfig));
    setScenarioVoteData(cloneVoteData(results.voteData || {}));
    setAddAgreementA('');
    setAddAgreementB('');
  }, [currentElection, electionConfig, results]);

  const normalizedScenario = useMemo(() => {
    if (!scenarioConfig || !scenarioVoteData) return null;
    return normalizeScenarioInput({
      baseVoteData,
      scenarioVoteData,
      baseConfig,
      scenarioConfig,
    });
  }, [scenarioConfig, scenarioVoteData, baseVoteData, baseConfig]);

  const agreementValidation = useMemo(() => {
    if (!normalizedScenario) return { isValid: true, errors: [] };
    return validateAgreements(normalizedScenario.config.agreements, normalizedScenario.voteData);
  }, [normalizedScenario]);

  const baseResults = useMemo(
    () => computeScenarioResults(baseVoteData, baseConfig),
    [baseVoteData, baseConfig],
  );

  const scenarioResults = useMemo(() => {
    if (!normalizedScenario || !agreementValidation.isValid) return null;
    return computeScenarioResults(normalizedScenario.voteData, normalizedScenario.config);
  }, [normalizedScenario, agreementValidation.isValid]);

  const isEdited = useMemo(() => {
    if (!normalizedScenario) return false;
    return isScenarioEdited(
      { voteData: baseVoteData, config: baseConfig },
      { voteData: normalizedScenario.voteData, config: normalizedScenario.config },
    );
  }, [baseVoteData, baseConfig, normalizedScenario]);

  const activeResults = scenarioResults || baseResults;
  const activeVoteData = scenarioResults ? normalizedScenario?.voteData : baseVoteData;
  const activeConfig = scenarioResults ? normalizedScenario?.config : baseConfig;

  const partySeatDeltas = useMemo(() => computeSeatDeltas(
    baseResults.realResults,
    activeResults.realResults,
  ), [baseResults.realResults, activeResults.realResults]);

  const scenarioParties = useMemo(() => {
    if (!normalizedScenario) return [];
    return Object.entries(normalizedScenario.voteData)
      .filter(([party]) => !NON_PARTY_KEYS.has(party))
      .map(([party]) => party);
  }, [normalizedScenario]);

  const usedAgreementParties = new Set((scenarioConfig?.agreements || []).flat());
  const agreementSelectableParties = scenarioParties
    .filter((party) => !usedAgreementParties.has(party));

  const resetScenario = () => {
    setScenarioConfig(cloneConfig(baseConfig));
    setScenarioVoteData(cloneVoteData(baseVoteData));
    setAddAgreementA('');
    setAddAgreementB('');
  };

  const onVoteChange = (party, value) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return;
    const nextVotes = Math.max(0, parsed);
    setScenarioVoteData((prev) => ({
      ...prev,
      [party]: { votes: nextVotes },
    }));
  };

  const onAlgorithmChange = (nextAlgorithm) => {
    if (!nextAlgorithm) return;
    setScenarioConfig((prev) => ({
      ...prev,
      algorithm: nextAlgorithm,
    }));
  };

  const onBlockPercentageChange = (nextBlockPercentagePercent) => {
    const parsed = Number.parseFloat(String(nextBlockPercentagePercent).replace(',', '.'));
    if (!Number.isFinite(parsed)) return;
    const normalized = Math.min(100, Math.max(0, parsed));
    setScenarioConfig((prev) => ({
      ...prev,
      blockPercentage: normalized / 100,
    }));
  };

  const removeAgreement = (partyA, partyB) => {
    setScenarioConfig((prev) => ({
      ...prev,
      agreements: prev.agreements.filter(([a, b]) => !(a === partyA && b === partyB)),
    }));
  };

  const addAgreement = () => {
    if (!addAgreementA || !addAgreementB || addAgreementA === addAgreementB) return;
    setScenarioConfig((prev) => ({
      ...prev,
      agreements: [...prev.agreements, [addAgreementA, addAgreementB]],
    }));
    setAddAgreementA('');
    setAddAgreementB('');
  };

  return {
    scenarioConfig,
    scenarioVoteData,
    addAgreementA,
    setAddAgreementA,
    addAgreementB,
    setAddAgreementB,
    normalizedScenario,
    agreementValidation,
    baseVoteData,
    baseConfig,
    baseResults,
    activeResults,
    activeVoteData,
    activeConfig,
    partySeatDeltas,
    agreementSelectableParties,
    resetScenario,
    onVoteChange,
    onAlgorithmChange,
    onBlockPercentageChange,
    removeAgreement,
    addAgreement,
    isEdited,
  };
};
