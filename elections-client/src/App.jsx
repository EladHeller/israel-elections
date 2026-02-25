import React, { useState } from 'react';
import {
  computeBlocTotals,
  computeSeatMargins,
} from './lib/analytics.js';
import AppHeader from './components/AppHeader.jsx';
import AllElectionsSummary from './components/AllElectionsSummary.jsx';
import SummarySection from './components/SummarySection.jsx';
import SecondarySummarySection from './components/SecondarySummarySection.jsx';
import ElectionStatsSection from './components/ElectionStatsSection.jsx';
import { BottomPanels, MainPanels } from './components/ElectionPanels.jsx';
import CalcDetailsCard from './components/CalcDetailsCard.jsx';
import { useElectionData } from './hooks/use-election-data.js';
import { useScenario } from './hooks/use-scenario.js';

const NON_PARTY_KEYS = new Set(['﻿סמל ועדה', 'סמל ועדה']);

export default function App() {
  const [showBelowBlock, setShowBelowBlock] = useState(false);
  const [viewMode, setViewMode] = useState('simulator');

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
    results,
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

  if (!results || !currentElection || !scenarioConfig || !scenarioVoteData || !normalizedScenario) {
    return (
      <div className="screen loading">
        <h1>טוען נתונים...</h1>
      </div>
    );
  }

  const realResults = activeResults.realResults || {};
  const voteData = activeVoteData || {};
  const partyNameOverrides = Object.fromEntries(
    Object.entries(voteData)
      .filter(([, data]) => data && data.name)
      .map(([party, data]) => [party, data.name]),
  );
  const getPartyName = (party) => partyNames[party] || partyNameOverrides[party] || party;

  const sumVotes = Object.values(voteData).reduce((acc, { votes }) => acc + votes, 0);
  const blockThreshold = Math.ceil(sumVotes * activeConfig.blockPercentage);
  const configTotalVotes = electionConfig.totalVotes ?? sumVotes;
  const invalidVotesDerived = Math.max(0, configTotalVotes - sumVotes);

  const allParties = Object.entries(voteData)
    .filter(([party]) => !NON_PARTY_KEYS.has(party))
    .filter(([, data]) => data && data.votes > 0)
    .map(([party, { votes }]) => ({
      party,
      votes,
      mandats: realResults[party]?.mandats || 0,
      passed: votes >= blockThreshold,
    }))
    .sort((a, b) => b.mandats - a.mandats || b.votes - a.votes);
  const passedParties = allParties.filter((party) => party.passed);
  const parties = showBelowBlock ? allParties : passedParties;

  const baseSumVotes = Object.values(baseVoteData).reduce((acc, { votes }) => acc + votes, 0);
  const baseBlockThreshold = Math.ceil(baseSumVotes * baseConfig.blockPercentage);

  const nonParticipatingVotes = Object.entries(voteData)
    .filter(([party]) => !NON_PARTY_KEYS.has(party))
    .reduce((acc, [, data]) => {
      const votes = data?.votes || 0;
      if (votes < blockThreshold) return acc + votes;
      return acc;
    }, 0);
  const nonParticipatingPercent = sumVotes > 0 ? (nonParticipatingVotes / sumVotes) * 100 : 0;
  const participatingVotes = sumVotes - nonParticipatingVotes;
  const votesPerMandate = participatingVotes > 0 ? Math.round(participatingVotes / 120) : 0;

  const baseBlocTotals = computeBlocTotals(baseResults.realResults || {}, blocs);
  const blocTotals = computeBlocTotals(activeResults.realResults || {}, blocs);
  const blocSeatDeltas = Object.fromEntries(
    Object.keys(blocTotals).map((blocKey) => [
      blocKey,
      (blocTotals[blocKey] || 0) - (baseBlocTotals[blocKey] || 0),
    ]),
  );

  const blocOrder = blocs.order || Object.keys(blocs.blocks);
  const blocDataRaw = blocOrder.map((key) => blocTotals[key] || 0);
  const blocColorsRaw = blocOrder.map((key) => blocs.blocks[key].color);
  const blocLabelsRaw = blocOrder.map((key) => blocs.blocks[key].label);
  const blocFiltered = blocDataRaw.map((value, i) => ({
    value,
    color: blocColorsRaw[i],
    label: blocLabelsRaw[i],
  })).filter((item) => item.value > 0);
  const blocData = blocFiltered.map((item) => item.value);
  const blocColors = blocFiltered.map((item) => item.color);
  const blocLabels = blocFiltered.map((item) => item.label);

  const margins = computeSeatMargins(realResults, voteData, activeConfig)
    .sort((a, b) => (a.gain || Infinity) - (b.gain || Infinity));

  const partyToBloc = (blocs.order || []).reduce((acc, key) => {
    blocs.blocks[key].parties.forEach((party) => { acc[party] = key; });
    return acc;
  }, {});

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
            sumVotes={sumVotes}
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

          <MainPanels
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
            blocData={blocData}
            blocColors={blocColors}
            blocLabels={blocLabels}
            blocTotals={blocTotals}
            blocSeatDeltas={blocSeatDeltas}
          />

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
