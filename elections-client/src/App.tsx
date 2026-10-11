import React, { useState } from 'react';
import { computeBlocTotals } from './lib/analytics';
import AppHeader from './components/AppHeader';
import BlocsOverview from './components/BlocsOverview';
import ResultsUpdate from './components/ResultsUpdate';
import { useBlocPreferences } from './hooks/use-bloc-preferences';
import AllElectionsSummary from './components/AllElectionsSummary';
import ElectionSettingsSection from './components/ElectionSettingsSection';
import VoteDistributionSection from './components/VoteDistributionSection';
import ElectionStatsSection from './components/ElectionStatsSection';
import { BottomPanels, PartyPanel } from './components/ElectionPanels';
import CalcDetailsCard from './components/CalcDetailsCard';
import CloseRacesSection from './components/CloseRacesSection';
import { computeProximity } from './lib/proximity';
import PreElectionView from './components/PreElectionView';
import { useElectionData } from './hooks/use-election-data';
import { useScenario } from './hooks/use-scenario';
import { computeSeatDeltas } from './lib/scenario';
import { getElectionPhaseLabel, phaseHasResults } from './lib/election-manifest';
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

  const {
    availableElections,
    currentElection,
    setCurrentElection,
    results,
    previousResults,
    error,
    electionConfig,
    electionManifest,
    blocs: defaultBlocs,
    partyNames,
    isLatestElection,
  } = useElectionData();

  const { blocs, partyToBloc, assignParty, renameBloc, reset: resetBlocs, customized, saveFailed } =
    useBlocPreferences(currentElection, defaultBlocs);

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
  const statusText = getElectionPhaseLabel(electionManifest);

  if (!showResults) {
    return (
      <div className="screen">
        <AppHeader
          statusText={statusText}
          showSimulator={false}
          isEdited={false}
          currentElection={currentElection}
          setCurrentElection={setCurrentElection}
          availableElections={availableElections}
          viewMode={viewMode === 'simulator' ? 'results' : viewMode}
          setViewMode={setViewMode}
        />
        {viewMode === 'summary' ? (
          <AllElectionsSummary />
        ) : (
          <>
            <BlocsOverview key={currentElection} blocs={blocs} totals={{}} deltas={{}} results={{}}
              parties={electionManifest.lists.map((list) => list.ballotLetter)}
              partyToBloc={partyToBloc}
              getPartyName={(party) => electionManifest.lists.find((list) => list.ballotLetter === party)?.name || party}
              onAssign={assignParty} onRename={renameBloc} onReset={resetBlocs}
              customized={customized} saveFailed={saveFailed} hasResults={false} />
            <PreElectionView manifest={electionManifest} electionConfig={electionConfig} />
          </>
        )}
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
  const baseSumVotes = sumVotes(baseVoteData);
  // Election statistics describe the original results, even in the simulator.
  const configTotalVotes = electionConfig.totalVotes ?? baseSumVotes;
  const invalidVotesDerived = Math.max(0, configTotalVotes - baseSumVotes);

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

  const proximity = computeProximity(realResults, voteData, displayedConfig);

  return (
    <div className="screen">
      <AppHeader
        statusText={statusText}
        showSimulator
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
          {!isSimulator && electionManifest.phase === 'counting' && (
            <ResultsUpdate previous={previousResults} current={results}
              blockPercentage={baseConfig.blockPercentage} getPartyName={getPartyName} />
          )}
          <BlocsOverview key={currentElection} blocs={blocs} totals={blocTotals} deltas={blocSeatDeltas}
            parties={filterRealParties(voteData).map(([party]) => party)} results={realResults}
            partyToBloc={partyToBloc} getPartyName={getPartyName}
            onAssign={assignParty} onRename={renameBloc} onReset={resetBlocs}
            customized={customized} saveFailed={saveFailed} hasResults
            isCounting={electionManifest.phase === 'counting'} isSimulator={isSimulator} />
          <main className="results-layout">
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

            <CloseRacesSection
              proximity={proximity}
              blockPercentage={displayedConfig.blockPercentage}
              getPartyName={getPartyName}
              isCounting={!isSimulator && electionManifest.phase === 'counting'}
              onVoteDelta={isSimulator
                ? (party, delta) => onVoteChange(party, voteData[party].votes + delta)
                : undefined}
            />

          </main>
          <details className="election-details" key={`${currentElection}-${viewMode}`} open={isSimulator || undefined}>
            <summary>נתוני ההצבעה והגדרות החישוב</summary>
            <div className="election-details-body">
              <div className="election-summary">
                <ElectionStatsSection
                  turnoutPercentage={electionConfig.turnoutPercentage}
                  totalVotes={electionConfig.totalVotes}
                  invalidVotes={invalidVotesDerived}
                  validVotes={baseSumVotes}
                  isSimulator={isSimulator}
                />
                <VoteDistributionSection
                  nonParticipatingVotes={nonParticipatingVotes}
                  nonParticipatingPercent={nonParticipatingPercent}
                  participatingVotes={participatingVotes}
                  votesPerMandate={votesPerMandate}
                  isEdited={displayedIsEdited}
                />
              </div>
              <ElectionSettingsSection
                editable={isSimulator}
                blockThreshold={blockThreshold}
                baseBlockThreshold={baseBlockThreshold}
                activeConfig={displayedConfig}
                isEdited={displayedIsEdited}
                onBlockPercentageChange={onBlockPercentageChange}
                onAlgorithmChange={onAlgorithmChange}
              />

              <BottomPanels
                editable={isSimulator}
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

              <CalcDetailsCard
                voteData={voteData}
                activeConfig={displayedConfig}
                getPartyName={getPartyName}
              />
            </div>
          </details>
        </>
      )}
    </div>
  );
}
