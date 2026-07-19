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
import PreElectionView from './components/PreElectionView';
import { useElectionData } from './hooks/use-election-data';
import { useScenario } from './hooks/use-scenario';
import { computeSeatDeltas } from './lib/scenario';
import { getElectionPhaseLabel, phaseHasResults } from './lib/election-manifest';
import { formatTime } from './lib/ui-helpers';
import { canPassThresholdWithoutMandate, hasMandate } from './lib/calc';
import { DEFAULT_VIEW_MODE, selectViewData, viewUsesScenario } from './lib/view-mode';
import type { AppViewMode, PartyResult, ResultsMap, VoteData } from './types';

const NON_PARTY_KEYS = new Set(['﻿סמל ועדה', 'סמל ועדה']);

const sumVotes = (data: VoteData): number =>
  Object.values(data).reduce((acc, { votes }) => acc + votes, 0);

const filterRealParties = (data: VoteData) =>
  Object.entries(data)
    .filter(([party]) => !NON_PARTY_KEYS.has(party))
    .filter(([, value]) => value && Number.isFinite(value.votes));

export default function App() {
  const [showAllParties, setShowAllParties] = useState(false);
  const [viewMode, setViewMode] = useState<AppViewMode>(DEFAULT_VIEW_MODE);
  const [partyToBlocOverrides, setPartyToBlocOverrides] = useState<
    Record<string, Record<string, string | null>>
  >({});

  const {
    availableElections,
    currentElection,
    setCurrentElection,
    results,
    previousResults,
    error,
    electionConfig,
    electionManifest,
    blocs,
    partyNames,
    isLatestElection,
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

  if (!currentElection || !electionManifest) {
    return (
      <div className="screen loading">
        <h1>טוען נתונים...</h1>
      </div>
    );
  }

  const showResults = phaseHasResults(electionManifest.phase);
  const statusText =
    electionManifest.phase === 'counting' && results?.time
      ? `מעודכן ל-${formatTime(results.time)}`
      : getElectionPhaseLabel(electionManifest);

  if (!showResults) {
    return (
      <div className="screen">
        <AppHeader
          statusText={statusText}
          showViewControl={false}
          isEdited={false}
          currentElection={currentElection}
          setCurrentElection={setCurrentElection}
          availableElections={availableElections}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
        <PreElectionView
          electionId={currentElection}
          manifest={electionManifest}
        />
      </div>
    );
  }

  if (
    !results ||
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

  const isSimulator = viewUsesScenario(viewMode);
  const displayedResults = selectViewData(viewMode, baseResults, activeResults);
  const displayedVoteData = selectViewData(viewMode, baseVoteData, activeVoteData);
  const displayedConfig = selectViewData(viewMode, baseConfig, activeConfig);
  const displayedIsEdited = isSimulator && isEdited;
  const livePartySeatDeltas =
    electionManifest.phase === 'counting' && previousResults
      ? computeSeatDeltas(
          previousResults.realResults || {},
          baseResults.realResults || {},
        )
      : {};
  const displayedPartySeatDeltas = isSimulator
    ? partySeatDeltas
    : livePartySeatDeltas;

  const realResults: ResultsMap = displayedResults.realResults || {};
  const voteData: VoteData = displayedVoteData || {};

  const partyNameOverrides: Record<string, string> = Object.fromEntries(
    Object.entries(voteData)
      .filter(([, data]) => data && data.name)
      .map(([party, data]) => [party, data!.name as string]),
  );

  const getPartyName = (party: string): string =>
    partyNames[party] || partyNameOverrides[party] || party;

  const totalVotes = sumVotes(voteData);
  const blockThreshold = Math.ceil(totalVotes * displayedConfig.blockPercentage);
  const configTotalVotes = electionConfig.totalVotes ?? totalVotes;
  const invalidVotesDerived = Math.max(0, configTotalVotes - totalVotes);

  const allParties = filterRealParties(voteData)
    .filter(([, { votes }]) => votes > 0)
    .map(([party, { votes }]) => ({
      party,
      votes,
      mandats: (realResults[party] as PartyResult | undefined)?.mandats || 0,
    }))
    .sort((a, b) => b.mandats - a.mandats || b.votes - a.votes);

  const mandateParties = allParties.filter(hasMandate);
  const parties = showAllParties ? allParties : mandateParties;

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
  const blocTotals = computeBlocTotals(displayedResults.realResults || {}, blocs, partyToBloc);
  const comparedBlocTotals =
    !isSimulator && electionManifest.phase === 'counting' && previousResults
      ? computeBlocTotals(previousResults.realResults || {}, blocs, partyToBloc)
      : baseBlocTotals;

  const blocSeatDeltas: Record<string, number> = Object.fromEntries(
    Object.keys(blocTotals).map((blocKey) => [
      blocKey,
      (blocTotals[blocKey] || 0) - (comparedBlocTotals[blocKey] || 0),
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

  const margins = computeSeatMargins(realResults, voteData, displayedConfig).sort(
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
        statusText={statusText}
        showViewControl
        isEdited={displayedIsEdited}
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
            editable={isSimulator}
            sumVotes={totalVotes}
            baseSumVotes={baseSumVotes}
            blockThreshold={blockThreshold}
            baseBlockThreshold={baseBlockThreshold}
            activeConfig={displayedConfig}
            isEdited={displayedIsEdited}
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
              editable={isSimulator}
              isLatestElection={isLatestElection}
              isEdited={displayedIsEdited}
              parties={parties}
              mandateParties={mandateParties}
              blocs={blocs}
              partyToBloc={partyToBloc}
              getPartyName={getPartyName}
              partySeatDeltas={displayedPartySeatDeltas}
              normalizedScenario={{ voteData: displayedVoteData }}
              onVoteChange={onVoteChange}
              showAllParties={showAllParties}
              setShowAllParties={setShowAllParties}
              showZeroSeatLabel={canPassThresholdWithoutMandate(
                displayedConfig.blockPercentage,
              )}
              resetScenario={resetScenario}
            />
          </section>

          <BottomPanels
            editable={isSimulator}
            margins={margins}
            getPartyName={getPartyName}
            scenarioConfig={displayedConfig}
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
              editable
              blocs={blocs}
              blocData={blocData}
              blocColors={blocColors}
              blocLabels={blocLabels}
              blocTotals={blocTotals}
              blocSeatDeltas={blocSeatDeltas}
              partyToBloc={partyToBloc}
              onPartyBlocChange={handlePartyBlocChange}
              getPartyName={getPartyName}
              mandateParties={mandateParties}
            />
          </section>

          <CalcDetailsCard
            voteData={voteData}
            activeConfig={displayedConfig}
            getPartyName={getPartyName}
          />
        </>
      )}
    </div>
  );
}
