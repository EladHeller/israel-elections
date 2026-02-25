import React from 'react';
import { numberFormat, getStablePartyColor } from '../lib/ui-helpers.js';

const DeltaChip = ({ delta }) => {
  if (!delta) return null;
  return <span className={`delta-chip ${delta > 0 ? 'gain' : 'lose'}`}>{delta > 0 ? `+${delta}` : delta}</span>;
};

const Donut = ({ data, total, colors, labels }) => {
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

const BlocEditor = ({
  blocs,
  partyToBloc,
  parties,
  onPartyBlocChange,
  getPartyName,
}) => {
  const editableParties = parties || [];
  if (editableParties.length === 0) return null;

  const [gushAKey, gushBKey] = blocs.order || Object.keys(blocs.blocks);

  const groupA = editableParties.filter((p) => partyToBloc[p.party] === gushAKey);
  const groupB = editableParties.filter((p) => partyToBloc[p.party] === gushBKey);
  const unassigned = editableParties.filter(
    (p) => !partyToBloc[p.party] || ![gushAKey, gushBKey].includes(partyToBloc[p.party]),
  );

  const moveTo = (party, key) => {
    onPartyBlocChange(party, key);
  };

  const clearFromGroup = (party) => {
    onPartyBlocChange(party, null);
  };

  return (
    <div className="bloc-editor">
      <div className="bloc-editor-head">
        <span className="bloc-editor-title">שיוך מפלגות לגוש א / גוש ב</span>
      </div>
      <div className="bloc-editor-columns">
        <div className="bloc-editor-column">
          <div className="bloc-editor-column-title">{blocs.blocks[gushAKey].label}</div>
          <div className="bloc-editor-chips">
            {groupA.map((party) => (
              <button
                key={party.party}
                type="button"
                className="bloc-chip"
                onClick={() => clearFromGroup(party.party)}
                title="הסר מהגוש"
              >
                {getPartyName(party.party)}
              </button>
            ))}
          </div>
        </div>

        <div className="bloc-editor-column bloc-editor-column-unassigned">
          <div className="bloc-editor-column-title">ללא גוש</div>
          <div className="bloc-editor-chips">
            {unassigned.map((party) => (
              <div key={party.party} className="bloc-editor-unassigned-row">
                <span className="bloc-editor-party" title={party.party}>
                  {getPartyName(party.party)}
                </span>
                <div className="bloc-editor-actions">
                  <button
                    type="button"
                    className="bloc-chip small"
                    onClick={() => moveTo(party.party, gushAKey)}
                  >
                    {blocs.blocks[gushAKey].label}
                  </button>
                  <button
                    type="button"
                    className="bloc-chip small"
                    onClick={() => moveTo(party.party, gushBKey)}
                  >
                    {blocs.blocks[gushBKey].label}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bloc-editor-column">
          <div className="bloc-editor-column-title">{blocs.blocks[gushBKey].label}</div>
          <div className="bloc-editor-chips">
            {groupB.map((party) => (
              <button
                key={party.party}
                type="button"
                className="bloc-chip"
                onClick={() => clearFromGroup(party.party)}
                title="הסר מהגוש"
              >
                {getPartyName(party.party)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const PartyBars = ({
  parties,
  blocs,
  partyToBloc,
  maxMandats,
  getPartyName,
  partySeatDeltas,
  useCoalitionColors,
  editableVoteData,
  onVoteChange,
}) => (
  <div className="party-bars">
    {parties.map((party) => {
      const blocKey = partyToBloc[party.party] || 'other';
      const color = useCoalitionColors
        ? (blocs.blocks[blocKey]?.color || 'var(--ink-50)')
        : getStablePartyColor(party.party);
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

export const MainPanels = ({
  isLatestElection,
  parties,
  passedParties,
  blocs,
  partyToBloc,
  onPartyBlocChange,
  getPartyName,
  partySeatDeltas,
  normalizedScenario,
  onVoteChange,
  showBelowBlock,
  setShowBelowBlock,
  resetScenario,
  blocData,
  blocColors,
  blocLabels,
  blocTotals,
  blocSeatDeltas,
}) => (
  <section className="grid">
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

    <div className="panel">
      <h2>חלוקת גושים</h2>
      <div className="donut-wrap">
        <Donut data={blocData} total={120} colors={blocColors} labels={blocLabels} />
      </div>
      <BlocLegend blocs={blocs} totals={blocTotals} deltas={blocSeatDeltas} />
      <BlocEditor
        blocs={blocs}
        partyToBloc={partyToBloc}
        parties={passedParties}
        onPartyBlocChange={onPartyBlocChange}
        getPartyName={getPartyName}
      />
    </div>
  </section>
);

export const BottomPanels = ({
  margins,
  getPartyName,
  scenarioConfig,
  removeAgreement,
  addAgreementA,
  setAddAgreementA,
  addAgreementB,
  setAddAgreementB,
  agreementSelectableParties,
  addAgreement,
  agreementValidation,
}) => (
  <section className="grid">
    <div className="panel">
      <h2>קרובים למנדט נוסף / אובדן</h2>
      <div className="margins-head">
        <span className="margin-party">מפלגה</span>
        <span className="margin-change gain">+מנדט</span>
        <span className="margin-change lose">-מנדט</span>
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
);
