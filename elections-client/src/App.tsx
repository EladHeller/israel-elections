import React, { useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams, useLocation } from 'react-router-dom';
import { computeBlocTotals, computeBlocMap } from './lib/analytics';
import { canPreviewElectionDemo, electionDemo, electionDemoConfig } from './lib/election-demo';
import AppHeader from './components/AppHeader';
import { BlocsDistributionPanel } from './components/BlocsDistributionPanel';
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
import ScenarioShare from './components/ScenarioShare';
import SharedScenarioRoute from './components/SharedScenarioRoute';
import type { SharedScenario } from './lib/shared-scenario';
import { computeScenarioResults, computeSeatDeltas } from './lib/scenario';
import { getElectionPhaseLabel, phaseHasResults } from './lib/election-manifest';
import { canPassThresholdWithoutMandate, hasMandate } from './lib/calc';
import { selectViewData, viewUsesScenario } from './lib/view-mode';
import type { AppViewMode, PartyResult, ResultsMap, VoteData } from './types';

const NON_PARTY_KEYS = new Set(['﻿סמל ועדה', 'סמל ועדה']);

const sumVotes = (data: VoteData): number =>
  Object.values(data).reduce((acc, { votes }) => acc + votes, 0);

const filterRealParties = (data: VoteData) =>
  Object.entries(data)
    .filter(([party]) => !NON_PARTY_KEYS.has(party))
    .filter(([, value]) => value && Number.isFinite(value.votes));

function NotFound() {
  return <main className="screen error">
    <h1>404 — הדף לא נמצא</h1>
    <p>הכתובת או מערכת הבחירות שביקשת אינן קיימות.</p>
    <Link to="/">חזרה לתוצאות הבחירות</Link>
  </main>;
}

function ElectionRoute({ viewMode }: { viewMode: AppViewMode }) {
  const { electionId } = useParams();
  const { hash } = useLocation();
  if (viewMode === 'simulator' && electionId && hash.startsWith('#scenario=')) {
    return <SharedScenarioRoute key={`${electionId}${hash}`} token={hash.slice(10)} election={electionId}>
      {snapshot => <ElectionScreen electionId={electionId} viewMode={viewMode} shared={snapshot} />}
    </SharedScenarioRoute>;
  }
  return <ElectionScreen key={electionId ?? 'default'} electionId={electionId} viewMode={viewMode} />;
}

export default function App() {
  return <Routes>
    <Route caseSensitive path="/index.html" element={<Navigate to="/" replace />} />
    <Route caseSensitive path="/" element={<ElectionRoute viewMode="results" />} />
    <Route caseSensitive path="/results/:electionId" element={<ElectionRoute viewMode="results" />} />
    <Route caseSensitive path="/simulator/:electionId" element={<ElectionRoute viewMode="simulator" />} />
    <Route caseSensitive path="/summary" element={<ElectionRoute viewMode="summary" />} />
    <Route caseSensitive path="*" element={<NotFound />} />
  </Routes>;
}

function ElectionScreen({ electionId, viewMode, shared }: { electionId?: string; viewMode: AppViewMode; shared?: SharedScenario }) {
  const navigate = useNavigate();
  const [showAllParties, setShowAllParties] = useState(false);

  const {
    availableElections,
    currentElection,
    results: officialResults,
    previousResults: previousOfficialResults,
    error,
    electionConfig: officialConfig,
    electionManifest: officialManifest,
    blocs: defaultBlocs,
    partyNames,
    isLatestElection,
  } = useElectionData(electionId, viewMode !== 'summary' && !shared);

  const setCurrentElection = (id: string) => navigate(`/${viewMode === 'summary' ? 'results' : viewMode}/${id}`);
  const setViewMode = (mode: AppViewMode) => navigate(mode === 'summary' ? '/summary' : `/${mode}/${currentElection}`);

  const isDemo = shared ? shared.demo : canPreviewElectionDemo(currentElection, officialManifest?.phase, isLatestElection)
    && viewMode !== 'summary';
  const sharedResults = useMemo(() => shared ? computeScenarioResults(shared.base.voteData, shared.base.config) : null, [shared]);
  const results = sharedResults ?? (isDemo ? electionDemo.current : officialResults);
  const previousResults = isDemo ? electionDemo.previous : previousOfficialResults;
  const electionConfig = shared?.base.config ?? (isDemo ? electionDemoConfig : officialConfig);
  const electionManifest = isDemo && officialManifest
    ? { ...officialManifest, phase: 'counting' as const }
    : officialManifest;

  const { blocs: personalBlocs, partyToBloc: personalPartyToBloc, assignParty, renameBloc, reset: resetBlocs, customized, saveFailed } =
    useBlocPreferences(currentElection, defaultBlocs);
  const [historicalAssignments, setHistoricalAssignments] = useState<Record<string, Record<string, string | null>>>({});
  const blocs = isLatestElection ? personalBlocs : defaultBlocs;
  const partyToBloc = isLatestElection ? personalPartyToBloc : {
    ...computeBlocMap(defaultBlocs),
    ...historicalAssignments[currentElection || ''],
  };
  const electionNight = isLatestElection && viewMode !== 'summary';
  const screenClass = electionNight ? 'screen election-night' : 'screen';

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
    initialScenario: shared?.scenario,
  });

  if (error) {
    return (
      <div className="screen error">
        <h1>שגיאה בהבאת הנתונים</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (availableElections.length && electionId !== undefined && !availableElections.includes(electionId)) {
    return <NotFound />;
  }

  if (currentElection && electionId === undefined && viewMode !== 'summary') {
    return <Navigate to={`/results/${currentElection}`} replace />;
  }

  if (viewMode === 'summary') {
    return <div className="screen">
      <AppHeader statusText="סיכום כל מערכות הבחירות"
        showSimulator={!!officialManifest && (phaseHasResults(officialManifest.phase)
          || canPreviewElectionDemo(currentElection, officialManifest.phase, isLatestElection))}
        isEdited={false} currentElection={currentElection} setCurrentElection={setCurrentElection}
        availableElections={availableElections} viewMode={viewMode} setViewMode={setViewMode} />
      <AllElectionsSummary />
    </div>;
  }

  if (!currentElection || !electionManifest) {
    return (
      <div className="screen loading">
        <h1>טוען נתונים...</h1>
      </div>
    );
  }

  const showResults = !!shared || phaseHasResults(electionManifest.phase);
  const statusText = shared ? (isDemo ? 'תרחיש משותף · מידע דמה בלבד' : 'תרחיש משותף') : isDemo ? 'תוצאות מתעדכנות · מידע דמה בלבד' : getElectionPhaseLabel(electionManifest);

  if (!showResults && viewMode === 'simulator') {
    return <Navigate to={`/results/${currentElection}`} replace />;
  }

  if (!showResults) {
    return (
      <div className={screenClass}>
        <AppHeader
          statusText={statusText}
          showSimulator={false}
          isEdited={false}
          currentElection={currentElection}
          setCurrentElection={setCurrentElection}
          availableElections={availableElections}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
        {electionNight && <BlocsOverview key={currentElection} blocs={blocs} totals={{}} deltas={{}} results={{}}
          parties={electionManifest.lists.map((list) => list.ballotLetter)}
          partyToBloc={partyToBloc}
          getPartyName={(party) => electionManifest.lists.find((list) => list.ballotLetter === party)?.name || party}
          onAssign={assignParty} onRename={renameBloc} onReset={resetBlocs}
          customized={customized} saveFailed={saveFailed} hasResults={false} />}
        <PreElectionView manifest={electionManifest} electionConfig={electionConfig} electionNight={electionNight} />
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
    shared?.base.voteData[party]?.name || partyNames[party] || partyNameOverrides[party] || party;

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

  const blocEntries = (blocs.order || Object.keys(blocs.blocks))
    .map((key) => ({ ...blocs.blocks[key], value: blocTotals[key] || 0 }))
    .filter(({ value }) => value > 0);

  const partyPanel = (
    <section className="grid grid-single">
      <PartyPanel
        editable={isSimulator}
        isLatestElection={isLatestElection}
        isDemo={isDemo}
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
  );
  const closeRaces = (
    <CloseRacesSection
      proximity={proximity}
      blockPercentage={displayedConfig.blockPercentage}
      getPartyName={getPartyName}
      isCounting={!isDemo && !isSimulator && electionManifest.phase === 'counting'}
      onVoteDelta={isSimulator
        ? (party, delta) => onVoteChange(party, voteData[party].votes + delta)
        : undefined}
    />
  );
  const statistics = (
    <div className="election-summary">
      <ElectionStatsSection
        turnoutPercentage={electionConfig.turnoutPercentage}
        totalVotes={electionConfig.totalVotes}
        invalidVotes={invalidVotesDerived}
        validVotes={baseSumVotes}
        isSimulator={isSimulator}
        isDemo={isDemo}
      />
      <VoteDistributionSection
        nonParticipatingVotes={nonParticipatingVotes}
        nonParticipatingPercent={nonParticipatingPercent}
        participatingVotes={participatingVotes}
        votesPerMandate={votesPerMandate}
        isEdited={displayedIsEdited}
      />
    </div>
  );
  const settings = (
    <ElectionSettingsSection
      editable={isSimulator}
      blockThreshold={blockThreshold}
      baseBlockThreshold={baseBlockThreshold}
      activeConfig={displayedConfig}
      isEdited={displayedIsEdited}
      onBlockPercentageChange={onBlockPercentageChange}
      onAlgorithmChange={onAlgorithmChange}
    />
  );
  const agreements = (
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
  );
  const calculationDetails = (
    <CalcDetailsCard
      voteData={voteData}
      activeConfig={displayedConfig}
      getPartyName={getPartyName}
    />
  );

  return (
    <div className={screenClass}>
      <AppHeader
        statusText={statusText}
        showSimulator
        isEdited={displayedIsEdited}
        currentElection={currentElection}
        setCurrentElection={setCurrentElection}
        availableElections={availableElections}
        viewMode={viewMode}
        setViewMode={setViewMode}
        statusAction={shared && <Link className="shared-scenario-return" to={`/simulator/${currentElection}`}>חזרה לנתונים העדכניים</Link>}
        actions={isSimulator && <ScenarioShare disabled={!agreementValidation.isValid} snapshot={{
          version: 1, election: currentElection, demo: isDemo,
          base: { voteData: Object.fromEntries(Object.entries(baseVoteData).map(([party, data]) =>
            [party, { ...data, name: getPartyName(party) }])), config: baseConfig },
          scenario: normalizedScenario,
        }} />}
      />

      {electionNight ? (
        <>
          {isDemo && <aside className="demo-banner" aria-label="מידע דמה בלבד">
            <div><strong>מידע דמה בלבד</strong><span>המספרים מומצאים להמחשה — אינם תוצאות אמת או סקר.</span></div>
          </aside>}
          {!isSimulator && electionManifest.phase === 'counting' && (
            <ResultsUpdate isDemo={isDemo} previous={previousResults} current={results}
              blockPercentage={baseConfig.blockPercentage} getPartyName={getPartyName} />
          )}
          <BlocsOverview key={currentElection} blocs={blocs} totals={blocTotals} deltas={blocSeatDeltas}
            parties={filterRealParties(voteData).map(([party]) => party)} results={realResults}
            partyToBloc={partyToBloc} getPartyName={getPartyName}
            onAssign={assignParty} onRename={renameBloc} onReset={resetBlocs}
            customized={customized} saveFailed={saveFailed} hasResults
            isCounting={electionManifest.phase === 'counting'} isSimulator={isSimulator} isDemo={isDemo} />
          <main className="results-layout">
            {partyPanel}

            {closeRaces}

          </main>
          <div className="election-details">
            {statistics}
            {settings}
            {agreements}
            {calculationDetails}
          </div>
        </>
      ) : (
        <>
          {statistics}
          {settings}
          {partyPanel}
          {closeRaces}
          {agreements}
          <section className="grid grid-single">
            <BlocsDistributionPanel
              editable blocs={blocs}
              blocData={blocEntries.map(({ value }) => value)}
              blocColors={blocEntries.map(({ color }) => color)}
              blocLabels={blocEntries.map(({ label }) => label)}
              blocTotals={blocTotals} blocSeatDeltas={blocSeatDeltas}
              partyToBloc={partyToBloc}
              onPartyBlocChange={(party, blocKey) => setHistoricalAssignments((previous) => ({
                ...previous,
                [currentElection]: { ...previous[currentElection], [party]: blocKey },
              }))}
              getPartyName={getPartyName} mandateParties={mandateParties}
            />
          </section>
          {calculationDetails}
        </>
      )}
    </div>
  );
}
