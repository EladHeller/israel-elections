import { useEffect, useMemo, useState } from 'react';
import {
  computeScenarioResults,
  computeSeatDeltas,
  isScenarioEdited,
  normalizeScenarioInput,
  validateAgreements,
} from '../lib/scenario';
import type { AgreementValidation, ElectionConfig, ScenarioState } from '../types';
import type { CalcResults, CalcVoteData } from '../lib/calc';
import type { ElectionResultsPayload } from '../types';

const NON_PARTY_KEYS = new Set(['﻿סמל ועדה', 'סמל ועדה']);

const cloneConfig = (config: ElectionConfig): ElectionConfig => ({
  algorithm: config.algorithm,
  blockPercentage: config.blockPercentage,
  agreements: (config.agreements || []).map(([a, b]) => [a, b]),
  turnoutPercentage: config.turnoutPercentage,
  totalVotes: config.totalVotes,
  finalResults: config.finalResults,
});

const cloneVoteData = (voteData: CalcVoteData = {} as CalcVoteData): CalcVoteData =>
  Object.fromEntries(
    Object.entries(voteData)
      .filter(([party]) => !NON_PARTY_KEYS.has(party))
      .map(([party, data]) => [
        party,
        { ...data, votes: data.votes, mandats: data.mandats ?? 0 },
      ]),
  ) as CalcVoteData;

export interface UseScenarioArgs {
  results: (ElectionResultsPayload & { voteData?: CalcVoteData }) | null;
  electionConfig: ElectionConfig;
  currentElection: string | null;
}

export interface UseScenarioResult {
  scenarioConfig: ElectionConfig | null;
  scenarioVoteData: CalcVoteData | null;
  addAgreementA: string;
  setAddAgreementA: (value: string) => void;
  addAgreementB: string;
  setAddAgreementB: (value: string) => void;
  normalizedScenario: ScenarioState | null;
  agreementValidation: AgreementValidation;
  baseVoteData: CalcVoteData;
  baseConfig: ElectionConfig;
  baseResults: CalcResults;
  activeResults: CalcResults;
  activeVoteData: CalcVoteData;
  activeConfig: ElectionConfig;
  partySeatDeltas: Record<string, number>;
  agreementSelectableParties: string[];
  resetScenario: () => void;
  onVoteChange: (party: string, value: string | number) => void;
  onAlgorithmChange: (nextAlgorithm: ElectionConfig['algorithm']) => void;
  onBlockPercentageChange: (nextBlockPercentagePercent: string | number) => void;
  removeAgreement: (partyA: string, partyB: string) => void;
  addAgreement: () => void;
  isEdited: boolean;
}

export const useScenario = ({
  results,
  electionConfig,
  currentElection,
}: UseScenarioArgs): UseScenarioResult => {
  const [scenarioConfig, setScenarioConfig] = useState<ElectionConfig | null>(null);
  const [scenarioVoteData, setScenarioVoteData] = useState<CalcVoteData | null>(null);
  const [addAgreementA, setAddAgreementA] = useState('');
  const [addAgreementB, setAddAgreementB] = useState('');

  const baseVoteData = useMemo(
    () => cloneVoteData((results as any)?.voteData || {}),
    [results],
  );
  const baseConfig = useMemo(() => cloneConfig(electionConfig), [electionConfig]);

  useEffect(() => {
    if (!results) return;
    setScenarioConfig(cloneConfig(electionConfig));
    setScenarioVoteData(cloneVoteData((results as any).voteData || {}));
    setAddAgreementA('');
    setAddAgreementB('');
  }, [currentElection, electionConfig, results]);

  const normalizedScenario = useMemo<ScenarioState | null>(() => {
    if (!scenarioConfig || !scenarioVoteData) return null;
    return normalizeScenarioInput({
      baseVoteData,
      scenarioVoteData,
      baseConfig,
      scenarioConfig,
    });
  }, [scenarioConfig, scenarioVoteData, baseVoteData, baseConfig]);

  const agreementValidation = useMemo<AgreementValidation>(() => {
    if (!normalizedScenario) return { isValid: true, errors: [] };
    return validateAgreements(
      normalizedScenario.config.agreements,
      normalizedScenario.voteData,
    );
  }, [normalizedScenario]);

  const baseResults = useMemo<CalcResults>(
    () => computeScenarioResults(baseVoteData, baseConfig),
    [baseVoteData, baseConfig],
  );

  const scenarioResults = useMemo<CalcResults | null>(() => {
    if (!normalizedScenario || !agreementValidation.isValid) return null;
    return computeScenarioResults(normalizedScenario.voteData, normalizedScenario.config);
  }, [normalizedScenario, agreementValidation.isValid]);

  const isEdited = useMemo<boolean>(() => {
    if (!normalizedScenario) return false;
    return isScenarioEdited(
      { voteData: baseVoteData, config: baseConfig },
      { voteData: normalizedScenario.voteData, config: normalizedScenario.config },
    );
  }, [baseVoteData, baseConfig, normalizedScenario]);

  const activeResults: CalcResults = scenarioResults || baseResults;
  const activeVoteData: CalcVoteData =
    scenarioResults && normalizedScenario ? normalizedScenario.voteData : baseVoteData;
  const activeConfig: ElectionConfig =
    scenarioResults && normalizedScenario ? normalizedScenario.config : baseConfig;

  const partySeatDeltas = useMemo(
    () => computeSeatDeltas(baseResults.realResults, activeResults.realResults),
    [baseResults.realResults, activeResults.realResults],
  );

  const scenarioParties = useMemo<string[]>(() => {
    if (!normalizedScenario) return [];
    return Object.entries(normalizedScenario.voteData)
      .filter(([party]) => !NON_PARTY_KEYS.has(party))
      .map(([party]) => party);
  }, [normalizedScenario]);

  const usedAgreementParties = new Set((scenarioConfig?.agreements || []).flat());
  const agreementSelectableParties = scenarioParties.filter(
    (party) => !usedAgreementParties.has(party),
  );

  const resetScenario = () => {
    setScenarioConfig(cloneConfig(baseConfig));
    setScenarioVoteData(cloneVoteData(baseVoteData));
    setAddAgreementA('');
    setAddAgreementB('');
  };

  const onVoteChange = (party: string, value: string | number) => {
    const parsed = Number.parseInt(String(value), 10);
    if (Number.isNaN(parsed)) return;
    const nextVotes = Math.max(0, parsed);
    setScenarioVoteData((prev) => ({
      ...(prev || {}),
      [party]: { votes: nextVotes, mandats: (prev?.[party]?.mandats ?? 0) },
    }));
  };

  const onAlgorithmChange = (nextAlgorithm: ElectionConfig['algorithm']) => {
    if (!nextAlgorithm) return;
    setScenarioConfig((prev) =>
      prev
        ? {
            ...prev,
            algorithm: nextAlgorithm,
          }
        : prev,
    );
  };

  const onBlockPercentageChange = (nextBlockPercentagePercent: string | number) => {
    const parsed = Number.parseFloat(String(nextBlockPercentagePercent).replace(',', '.'));
    if (!Number.isFinite(parsed)) return;
    const normalized = Math.min(100, Math.max(0, parsed));
    setScenarioConfig((prev) =>
      prev
        ? {
            ...prev,
            blockPercentage: normalized / 100,
          }
        : prev,
    );
  };

  const removeAgreement = (partyA: string, partyB: string) => {
    setScenarioConfig((prev) =>
      prev
        ? {
            ...prev,
            agreements: prev.agreements.filter(
              ([a, b]) => !(a === partyA && b === partyB),
            ),
          }
        : prev,
    );
  };

  const addAgreement = () => {
    if (!addAgreementA || !addAgreementB || addAgreementA === addAgreementB) return;
    setScenarioConfig((prev) =>
      prev
        ? {
            ...prev,
            agreements: [...prev.agreements, [addAgreementA, addAgreementB]],
          }
        : prev,
    );
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

