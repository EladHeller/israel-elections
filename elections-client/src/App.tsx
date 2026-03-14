import React, { useState } from 'react';
import {
  computeBlocTotals,
  computeSeatMargins,
  computeBlocMap,
} from './lib/analytics';
import AppHeader from './components/AppHeader';
import AllElectionsSummary from './components/AllElectionsSummary';
import SummarySection from './components/SummarySection';
import SecondarySummarySection from './components/SecondarySummarySection';
import ElectionStatsSection from './components/ElectionStatsSection';
import { BottomPanels, PartyPanel, BlocsDistributionPanel } from './components/ElectionPanels';
import CalcDetailsCard from './components/CalcDetailsCard';
import { useElectionData } from './hooks/use-election-data';
import { useScenario } from './hooks/use-scenario';
import type { PartyResult, ResultsMap, VoteData } from './types';

const NON_PARTY_KEYS = new Set(['﻿סמל ועדה', 'סמל ועדה']);

const sumVotes = (data: VoteData): number =>
  Object.values(data).reduce((acc, { votes }) => acc + votes, 0);

const filterRealParties = (data: VoteData) =>
  Object.entries(data)
    .filter(([party]) => !NON_PARTY_KEYS.has(party))
    .filter(([, value]) => value && value.votes > 0);

export default function App() {
  const [showBelowBlock, setShowBelowBlock] = useState(false);
  const [viewMode, setViewMode] = useState<'simulator' | 'summary'>('simulator');
  const [partyToBlocOverrides, setPartyToBlocOverrides] = useState<
    Record<string, Record<string, string | null>>
  >({});

  const {
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
  } = useElectionData();

  const {
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
  } = useScenario({
    results: results as any,
    electionConfig,
    currentElection,
  });

  if (error) {
    return (
      <div className="screen error">
        <h1>שגיאה בהבאת הנתונים</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (
    !results ||
    !currentElection ||
    !scenarioConfig ||
    !scenarioVoteData ||
    !normalizedScenario
  ) {
    return (
      <div className="screen loading">
        <h1>טוען נתונים...</h1>
      </div>
    );
  }

  const realResults: ResultsMap = activeResults.realResults || {};
  const voteData: VoteData = activeVoteData || {};

  const partyNameOverrides: Record<string, string> = Object.fromEntries(
    Object.entries(voteData)
      .filter(([, data]) => data && data.name)
      .map(([party, data]) => [party, data!.name as string]),
  );

  const getPartyName = (party: string): string =>
    partyNames[party] || partyNameOverrides[party] || party;

  const totalVotes = sumVotes(voteData);
  const blockThreshold = Math.ceil(totalVotes * activeConfig.blockPercentage);
  const configTotalVotes = electionConfig.totalVotes ?? totalVotes;
  const invalidVotesDerived = Math.max(0, configTotalVotes - totalVotes);

  const allParties = filterRealParties(voteData)
    .map(([party, { votes }]) => ({
      party,
      votes,
      mandats: (realResults[party] as PartyResult | undefined)?.mandats || 0,
      passed: votes >= blockThreshold,
    }))
    .sort((a, b) => b.mandats - a.mandats || b.votes - a.votes);

  const passedParties = allParties.filter((party) => party.passed);
  const parties = showBelowBlock ? allParties : passedParties;

  const baseSumVotes = sumVotes(baseVoteData);
  const baseBlockThreshold = Math.ceil(baseSumVotes * baseConfig.blockPercentage);

  const nonParticipatingVotes = filterRealParties(voteData).reduce(
    (acc, [, data]) => {
      const votes = data?.votes || 0;
      if (votes < blockThreshold) return acc + votes;
      return acc;
    },
    0,
  );

  const nonParticipatingPercent =
    totalVotes > 0 ? (nonParticipatingVotes / totalVotes) * 100 : 0;
  const participatingVotes = totalVotes - nonParticipatingVotes;
  const votesPerMandate =
    participatingVotes > 0 ? Math.round(participatingVotes / 120) : 0;

  const basePartyToBloc = computeBlocMap(blocs);
  const electionKey = currentElection;
  const electionOverrides = partyToBlocOverrides[electionKey] || {};
  const partyToBloc = { ...basePartyToBloc, ...electionOverrides };

  const baseBlocTotals = computeBlocTotals(baseResults.realResults || {}, blocs, partyToBloc);
  const blocTotals = computeBlocTotals(activeResults.realResults || {}, blocs, partyToBloc);

  const blocSeatDeltas: Record<string, number> = Object.fromEntries(
    Object.keys(blocTotals).map((blocKey) => [
      blocKey,
      (blocTotals[blocKey] || 0) - (baseBlocTotals[blocKey] || 0),
    ]),
  );

  const blocOrder = blocs.order || Object.keys(blocs.blocks);
  const blocDataRaw = blocOrder.map((key) => blocTotals[key] || 0);
  const blocColorsRaw = blocOrder.map((key) => blocs.blocks[key].color);
  const blocLabelsRaw = blocOrder.map((key) => blocs.blocks[key].label);

  const blocFiltered = blocDataRaw
    .map((value, i) => ({
      value,
      color: blocColorsRaw[i],
      label: blocLabelsRaw[i],
    }))
    .filter((item) => item.value > 0);

  const blocData = blocFiltered.map((item) => item.value);
  const blocColors = blocFiltered.map((item) => item.color);
  const blocLabels = blocFiltered.map((item) => item.label);

  const margins = computeSeatMargins(realResults, voteData, activeConfig).sort(
    (a, b) => (a.gain ?? Infinity) - (b.gain ?? Infinity),
  );

  const handlePartyBlocChange = (party: string, blocKey: string | null) => {
    if (!electionKey) return;
    setPartyToBlocOverrides((prev) => ({
      ...prev,
      [electionKey]: {
        ...(prev[electionKey] || {}),
        [party]: blocKey,
      },
    }));
  };

  return (
    <div className="screen">
      <AppHeader
        hasFinalResults={hasFinalResults}
        resultsTime={results.time}
        isEdited={isEdited}
        currentElection={currentElection}
        setCurrentElection={setCurrentElection}
        availableElections={availableElections}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {viewMode === 'summary' ? (
        <AllElectionsSummary />
      ) : (
        <>
          <SummarySection
            sumVotes={totalVotes}
            baseSumVotes={baseSumVotes}
            blockThreshold={blockThreshold}
            baseBlockThreshold={baseBlockThreshold}
            activeConfig={activeConfig}
            isEdited={isEdited}
            onBlockPercentageChange={onBlockPercentageChange}
            onAlgorithmChange={onAlgorithmChange}
          />

          <SecondarySummarySection
            nonParticipatingVotes={nonParticipatingVotes}
            nonParticipatingPercent={nonParticipatingPercent}
            participatingVotes={participatingVotes}
            votesPerMandate={votesPerMandate}
          />

          <ElectionStatsSection
            turnoutPercentage={electionConfig.turnoutPercentage}
            totalVotes={electionConfig.totalVotes}
            invalidVotes={invalidVotesDerived}
          />

          <section className="grid grid-single">
            <PartyPanel
              isLatestElection={isLatestElection}
              parties={parties}
              passedParties={passedParties}
              blocs={blocs}
              partyToBloc={partyToBloc}
              getPartyName={getPartyName}
              partySeatDeltas={partySeatDeltas}
              normalizedScenario={normalizedScenario}
              onVoteChange={onVoteChange}
              showBelowBlock={showBelowBlock}
              setShowBelowBlock={setShowBelowBlock}
              resetScenario={resetScenario}
            />
          </section>

          <BottomPanels
            margins={margins}
            getPartyName={getPartyName}
            scenarioConfig={scenarioConfig}
            removeAgreement={removeAgreement}
            addAgreementA={addAgreementA}
            setAddAgreementA={setAddAgreementA}
            addAgreementB={addAgreementB}
            setAddAgreementB={setAddAgreementB}
            agreementSelectableParties={agreementSelectableParties}
            addAgreement={addAgreement}
            agreementValidation={agreementValidation}
          />

          <section className="grid grid-single">
            <BlocsDistributionPanel
              blocs={blocs}
              blocData={blocData}
              blocColors={blocColors}
              blocLabels={blocLabels}
              blocTotals={blocTotals}
              blocSeatDeltas={blocSeatDeltas}
              partyToBloc={partyToBloc}
              onPartyBlocChange={handlePartyBlocChange}
              getPartyName={getPartyName}
              passedParties={passedParties}
            />
          </section>

          <CalcDetailsCard
            voteData={voteData}
            activeConfig={activeConfig}
            getPartyName={getPartyName}
          />
        </>
      )}
    </div>
  );
}
