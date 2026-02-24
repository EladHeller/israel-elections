import React, { useEffect, useMemo, useState } from 'react';
import blocsConfigAll from './data/blocs.json';
import electionsConfigAll from './data/elections-config.json';
import partyNamesAll from './data/party-names.json';
import { detectAvailableElections, fetchElectionResults } from './lib/data.js';
import {
  computeBlocTotals,
  computeSeatMargins,
} from './lib/analytics.js';
import {
  computeScenarioResults,
  computeSeatDeltas,
  isScenarioEdited,
  normalizeScenarioInput,
  validateAgreements,
} from './lib/scenario.js';

const numberFormat = new Intl.NumberFormat('he-IL');
const NON_PARTY_KEYS = new Set(['﻿סמל ועדה', 'סמל ועדה']);
const PARTY_COLORS_CACHE = {};

const formatTime = (iso) => {
  if (!iso) return '';
  const time = new Date(iso);
  return `${time.getHours()}:${time.getMinutes().toString().padStart(2, '0')} ${new Intl.DateTimeFormat('he-IL').format(time)}`;
};

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

const getElectionConfig = (electionId) => electionsConfigAll[electionId] || {
  blockPercentage: 0.0325,
  agreements: [],
  algorithm: 'baderOffer',
};

const getBlocConfig = (electionId) => blocsConfigAll[electionId] || blocsConfigAll['25'];

const getPartyNames = (electionId) => partyNamesAll[electionId] || {};

const hashPartyKey = (party) => {
  let hash = 17;
  for (let i = 0; i < party.length; i += 1) {
    hash = ((hash * 31) + party.charCodeAt(i)) % 1000003;
  }
  return hash;
};

const getStablePartyColor = (party) => {
  if (PARTY_COLORS_CACHE[party]) return PARTY_COLORS_CACHE[party];
  const hash = hashPartyKey(party);
  const hue = hash % 360;
  const saturation = 60 + (Math.floor(hash / 7) % 20);
  const lightness = 42 + (Math.floor(hash / 97) % 14);
  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  PARTY_COLORS_CACHE[party] = color;
  return color;
};

const algorithmLabel = (algorithm) => (algorithm === 'baderOffer'
  ? 'שיטת בדר־עופר'
  : 'שיטת שאריות (עיגול כלפי מעלה)');

const DeltaChip = ({ delta }) => {
  if (!delta) return null;
  return <span className={`delta-chip ${delta > 0 ? 'gain' : 'lose'}`}>{delta > 0 ? `+${delta}` : delta}</span>;
};

const Donut = ({
  data,
  total,
  colors,
  labels,
}) => {
  const radius = 80;
  const stroke = 22;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 220 220" className="donut">
      <circle
        cx="110"
        cy="110"
        r={radius}
        fill="none"
        stroke="var(--ink-20)"
        strokeWidth={stroke}
      />
      {data.map((value, i) => {
        const length = (value / total) * circumference;
        const dash = `${length} ${circumference - length}`;
        const dashOffset = circumference - offset;
        offset += length;
        return (
          <circle
            key={labels[i]}
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke={colors[i]}
            strokeWidth={stroke}
            strokeDasharray={dash}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        );
      })}
      <text x="110" y="106" textAnchor="middle" className="donut-value">{total}</text>
      <text x="110" y="130" textAnchor="middle" className="donut-label">מנדטים</text>
    </svg>
  );
};

const BlocLegend = ({ blocs, totals, deltas }) => (
  <div className="legend">
    {blocs.order.map((key) => (
      <div key={key} className="legend-item">
        <span className="legend-swatch" style={{ background: blocs.blocks[key].color }} />
        <span>{blocs.blocks[key].label}</span>
        <span className="legend-value">
          {totals[key] || 0}
          <DeltaChip delta={deltas[key]} />
        </span>
      </div>
    ))}
  </div>
);

const PartyBars = ({
  parties,
  blocs,
  partyToBloc,
  maxMandats,
  getPartyName,
  partySeatDeltas,
  useCoalitionColors,
  getPartyColor,
  editableVoteData,
  onVoteChange,
}) => (
  <div className="party-bars">
    {parties.map((party) => {
      const blocKey = partyToBloc[party.party] || 'other';
      const color = useCoalitionColors
        ? (blocs.blocks[blocKey]?.color || 'var(--ink-50)')
        : getPartyColor(party.party);
      const width = maxMandats > 0 ? (party.mandats / maxMandats) * 100 : 0;
      return (
        <div key={party.party} className="party-row">
          <div className="party-meta" title={party.party}>
            <span className="party-name">{getPartyName(party.party)}</span>
            <span className="party-seats">
              {party.mandats}
              <DeltaChip delta={partySeatDeltas[party.party]} />
            </span>
          </div>
          <div className="party-bar">
            <div className="party-bar-fill" style={{ width: `${width}%`, background: color }} />
          </div>
          <div className="party-votes">
            <input
              className="party-vote-input"
              type="number"
              min="0"
              step="1"
              value={editableVoteData[party.party]?.votes ?? party.votes}
              onChange={(e) => onVoteChange(party.party, e.target.value)}
            />
            <span>קולות</span>
          </div>
        </div>
      );
    })}
  </div>
);

const SeatMargins = ({ margins, getPartyName }) => (
  <div className="margins">
    {margins.map((m) => (
      <div key={m.party} className="margin-row">
        <span className="margin-party" title={m.party}>{getPartyName(m.party)}</span>
        <span className="margin-change gain">+{m.gain ? numberFormat.format(m.gain) : '—'}</span>
        <span className="margin-change lose">-{m.lose ? numberFormat.format(m.lose) : '—'}</span>
      </div>
    ))}
  </div>
);

const AgreementsPanel = ({
  agreements,
  getPartyName,
  removeAgreement,
  addAgreementA,
  setAddAgreementA,
  addAgreementB,
  setAddAgreementB,
  agreementSelectableParties,
  addAgreement,
  agreementValidation,
}) => (
  <>
    <div className="scenario-agreements">
      {agreements.length === 0 && <div className="agreement-empty">אין הסכמי עודפים</div>}
      {agreements.map(([a, b]) => (
        <div key={`${a}-${b}`} className="agreement-edit-item">
          <span>{getPartyName(a)}</span>
          <span className="agreement-plus">+</span>
          <span>{getPartyName(b)}</span>
          <button type="button" className="ghost danger" onClick={() => removeAgreement(a, b)}>הסר</button>
        </div>
      ))}
    </div>

    <div className="add-agreement">
      <select value={addAgreementA} onChange={(e) => setAddAgreementA(e.target.value)}>
        <option value="">מפלגה א׳</option>
        {agreementSelectableParties.map((party) => (
          <option key={party} value={party}>{getPartyName(party)}</option>
        ))}
      </select>
      <select value={addAgreementB} onChange={(e) => setAddAgreementB(e.target.value)}>
        <option value="">מפלגה ב׳</option>
        {agreementSelectableParties
          .filter((party) => party !== addAgreementA)
          .map((party) => (
            <option key={party} value={party}>{getPartyName(party)}</option>
          ))}
      </select>
      <button type="button" onClick={addAgreement}>הוספת הסכם</button>
    </div>

    {!agreementValidation.isValid && (
      <div className="validation-errors">
        {agreementValidation.errors.map((msg) => <div key={msg}>{msg}</div>)}
      </div>
    )}
  </>
);

export default function App() {
  const [availableElections, setAvailableElections] = useState([]);
  const [currentElection, setCurrentElection] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showBelowBlock, setShowBelowBlock] = useState(false);

  const [scenarioConfig, setScenarioConfig] = useState(null);
  const [scenarioVoteData, setScenarioVoteData] = useState(null);
  const [addAgreementA, setAddAgreementA] = useState('');
  const [addAgreementB, setAddAgreementB] = useState('');

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
    setScenarioConfig(null);
    setScenarioVoteData(null);
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

  const config = useMemo(() => getElectionConfig(currentElection), [currentElection]);
  const blocs = useMemo(() => getBlocConfig(currentElection), [currentElection]);
  const partyNames = useMemo(() => getPartyNames(currentElection), [currentElection]);

  const baseVoteData = useMemo(() => cloneVoteData(results?.voteData || {}), [results]);
  const baseConfig = useMemo(() => cloneConfig(config), [config]);

  useEffect(() => {
    if (!results) return;
    setScenarioConfig(cloneConfig(config));
    setScenarioVoteData(cloneVoteData(results.voteData || {}));
    setAddAgreementA('');
    setAddAgreementB('');
  }, [currentElection, config, results]);

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
  const activeVoteData = scenarioResults ? normalizedScenario.voteData : baseVoteData;
  const activeConfig = scenarioResults ? normalizedScenario.config : baseConfig;

  const partySeatDeltas = useMemo(() => computeSeatDeltas(
    baseResults.realResults,
    activeResults.realResults,
  ), [baseResults.realResults, activeResults.realResults]);

  const baseBlocTotals = useMemo(
    () => computeBlocTotals(baseResults.realResults || {}, blocs),
    [baseResults.realResults, blocs],
  );
  const blocTotals = useMemo(
    () => computeBlocTotals(activeResults.realResults || {}, blocs),
    [activeResults.realResults, blocs],
  );
  const blocSeatDeltas = useMemo(() => Object.fromEntries(
    Object.keys(blocTotals).map((blocKey) => [
      blocKey,
      (blocTotals[blocKey] || 0) - (baseBlocTotals[blocKey] || 0),
    ]),
  ), [blocTotals, baseBlocTotals]);

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

  const isLatestElection = currentElection === availableElections[0];

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
  const blockPercent = (activeConfig.blockPercentage * 100).toFixed(2);

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

  const scenarioParties = Object.entries(normalizedScenario.voteData)
    .filter(([party]) => !NON_PARTY_KEYS.has(party))
    .map(([party]) => party);

  const baseSumVotes = Object.values(baseVoteData).reduce((acc, { votes }) => acc + votes, 0);
  const baseBlockThreshold = Math.ceil(baseSumVotes * baseConfig.blockPercentage);
  const baseBlockPercent = (baseConfig.blockPercentage * 100).toFixed(2);

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

  const usedAgreementParties = new Set((scenarioConfig.agreements || []).flat());
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

  return (
    <div className="screen">
      <header className="header">
        <div>
          <h1>תוצאות הבחירות לכנסת</h1>
          <div className="subtitle">
            מעודכן ל-{formatTime(results.time)}
            {isEdited && <span className="edited-tag">נתונים נערכו</span>}
          </div>
        </div>
        <div className="controls">
          <label>
            <span>כנסת</span>
            <select value={currentElection} onChange={(e) => setCurrentElection(e.target.value)}>
              {availableElections.map((election) => (
                <option key={election} value={election}>{election}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <section className="summary">
        <div className="card">
          <div className="card-label">סה"כ קולות כשרים</div>
          <div className="card-value">{numberFormat.format(sumVotes)}</div>
          {isEdited && <div className="card-sub">בסיס: {numberFormat.format(baseSumVotes)}</div>}
        </div>
        <div className="card">
          <div className="card-label">אחוז חסימה</div>
          <div className="card-value">{blockPercent}% ({numberFormat.format(blockThreshold)})</div>
          {isEdited && <div className="card-sub">בסיס: {baseBlockPercent}% ({numberFormat.format(baseBlockThreshold)})</div>}
        </div>
        <div className="card">
          <div className="card-label">שיטת חישוב</div>
          <select
            className="algorithm-select"
            value={activeConfig.algorithm}
            onChange={(e) => onAlgorithmChange(e.target.value)}
          >
            <option value="baderOffer">{algorithmLabel('baderOffer')}</option>
            <option value="ceilRound">{algorithmLabel('ceilRound')}</option>
          </select>
        </div>
      </section>

      <section className="summary summary-extra">
        <div className="card">
          <div className="card-label">סה"כ קולות שלא משתתפים בחלוקה</div>
          <div className="card-value">{numberFormat.format(nonParticipatingVotes)} ({nonParticipatingPercent.toFixed(2)}%)</div>
        </div>
        <div className="card">
          <div className="card-label">סה"כ קולות משתתפים בחלוקה</div>
          <div className="card-value">{numberFormat.format(participatingVotes)}</div>
        </div>
        <div className="card">
          <div className="card-label">מספר הקולות למנדט</div>
          <div className="card-value">{numberFormat.format(votesPerMandate)}</div>
        </div>
      </section>

      <section className={`grid ${isLatestElection ? '' : 'grid-single'}`}>
        <div className="panel">
          <div className="panel-head">
            <h2>מפלגות</h2>
            <button type="button" className="ghost" onClick={resetScenario}>איפוס לתוצאות מקור</button>
          </div>
          <PartyBars
            parties={parties}
            blocs={blocs}
            partyToBloc={partyToBloc}
            maxMandats={passedParties[0]?.mandats || 0}
            getPartyName={getPartyName}
            partySeatDeltas={partySeatDeltas}
            useCoalitionColors={isLatestElection}
            getPartyColor={getStablePartyColor}
            editableVoteData={normalizedScenario.voteData}
            onVoteChange={onVoteChange}
          />
          <label className="toggle">
            <input
              type="checkbox"
              checked={showBelowBlock}
              onChange={(event) => setShowBelowBlock(event.target.checked)}
            />
            <span>הראה מפלגות שלא עברו את אחוז החסימה</span>
          </label>
        </div>

        {isLatestElection && (
          <div className="panel">
            <h2>חלוקת גושים</h2>
            <div className="donut-wrap">
              <Donut data={blocData} total={120} colors={blocColors} labels={blocLabels} />
            </div>
            <BlocLegend blocs={blocs} totals={blocTotals} deltas={blocSeatDeltas} />
          </div>
        )}
      </section>

      <section className="grid">
        <div className="panel">
          <h2>קרובים למנדט נוסף / אובדן</h2>
          <div className="margins-head">
            <span>מפלגה</span>
            <span>+מנדט</span>
            <span>-מנדט</span>
          </div>
          <SeatMargins margins={margins} getPartyName={getPartyName} />
        </div>

        <div className="panel">
          <h2>הסכמי עודפים</h2>
          <AgreementsPanel
            agreements={scenarioConfig.agreements || []}
            getPartyName={getPartyName}
            removeAgreement={removeAgreement}
            addAgreementA={addAgreementA}
            setAddAgreementA={setAddAgreementA}
            addAgreementB={addAgreementB}
            setAddAgreementB={setAddAgreementB}
            agreementSelectableParties={agreementSelectableParties}
            addAgreement={addAgreement}
            agreementValidation={agreementValidation}
          />
        </div>
      </section>

    </div>
  );
}
