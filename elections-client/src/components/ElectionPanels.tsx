import React, { useEffect, useState } from 'react';
import { numberFormat, getStablePartyColor } from '../lib/ui-helpers';
import type { BlocsConfig } from '../types';
import PartyRow from './PartyRow';

interface DeltaChipProps {
  delta?: number | null;
  electionNight?: boolean;
}

const DeltaChip: React.FC<DeltaChipProps> = ({ delta, electionNight }) => {
  if (!delta) return null;
  return (
    <span dir={electionNight ? 'ltr' : undefined} className={`delta-chip ${delta > 0 ? 'gain' : 'lose'}`}>
      {delta > 0 ? `+${delta}` : delta}
    </span>
  );
};

interface PartySummary {
  party: string;
  votes: number;
  mandats: number;
}

interface PartyBarsProps {
  electionNight: boolean;
  editable: boolean;
  parties: PartySummary[];
  blocs: BlocsConfig;
  partyToBloc: Record<string, string | null | undefined>;
  maxMandats: number;
  getPartyName: (party: string) => string;
  partySeatDeltas: Record<string, number>;
  useCoalitionColors: boolean;
  editableVoteData: Record<string, { votes: number }>;
  onVoteChange: (party: string, value: string) => void;
}

const PartyBars: React.FC<PartyBarsProps> = ({
  electionNight,
  editable,
  parties,
  blocs,
  partyToBloc,
  maxMandats,
  getPartyName,
  partySeatDeltas,
  useCoalitionColors,
  editableVoteData,
  onVoteChange,
}) => {
  const [voteDrafts, setVoteDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setVoteDrafts(
      Object.fromEntries(
        parties.map((party) => [
          party.party,
          String(editableVoteData[party.party]?.votes ?? party.votes),
        ]),
      ),
    );
  }, [parties, editableVoteData]);

  const totalVotes = Object.values(editableVoteData).reduce((sum, data) => sum + data.votes, 0);
  return (
    <div className="party-bars">
      {parties.map((party) => {
        const blocKey = partyToBloc[party.party] || 'other';
        const color = useCoalitionColors
          ? blocs.blocks[blocKey]?.color || 'var(--ink-50)'
          : getStablePartyColor(party.party);
        const width = maxMandats > 0 ? (party.mandats / maxMandats) * 100 : 0;
        const draftValue =
          voteDrafts[party.party] ?? String(editableVoteData[party.party]?.votes ?? party.votes);
        const partyName = getPartyName(party.party);
        return (
          <PartyRow
            key={party.party}
            name={partyName}
            electionNight={electionNight}
            percentage={totalVotes > 0 ? `${(party.votes / totalVotes * 100).toLocaleString('he-IL', { maximumFractionDigits: 2 })}%` : '0%'}
            seats={electionNight ? (
              <>
                <span key={party.mandats} className={`seat-number${partySeatDeltas[party.party] ? ' seat-changed' : ''}`} aria-label={`${party.mandats} מנדטים`}>{party.mandats}</span>
                <span aria-label={editable ? 'שינוי לעומת התוצאות' : 'שינוי מהעדכון הקודם'}><DeltaChip electionNight delta={partySeatDeltas[party.party]} /></span>
              </>
            ) : <>{party.mandats}<DeltaChip delta={partySeatDeltas[party.party]} /></>}
            bar={{ width, color }}
            votes={
              editable ? (
                <input
                  className="party-vote-input"
                  type="number"
                  min="0"
                  step="1"
                  value={draftValue}
                  onChange={(e) =>
                    setVoteDrafts((prev) => ({ ...prev, [party.party]: e.target.value }))
                  }
                  onBlur={() => onVoteChange(party.party, voteDrafts[party.party] ?? draftValue)}
                />
              ) : (
                <span className="party-vote-value">
                  {numberFormat.format(party.votes)}
                </span>
              )
            }
          />
        );
      })}
    </div>
  );
};

interface AgreementsPanelProps {
  editable: boolean;
  agreements: [string, string][];
  getPartyName: (party: string) => string;
  removeAgreement: (a: string, b: string) => void;
  addAgreementA: string;
  setAddAgreementA: (value: string) => void;
  addAgreementB: string;
  setAddAgreementB: (value: string) => void;
  agreementSelectableParties: string[];
  addAgreement: () => void;
  agreementValidation: { isValid: boolean; errors: string[] };
}

const AgreementsPanel: React.FC<AgreementsPanelProps> = ({
  editable,
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
      {agreements.length === 0 && (
        <div className="agreement-empty">אין הסכמי עודפים</div>
      )}
      {agreements.map(([a, b]) => (
        <div key={`${a}-${b}`} className="agreement-edit-item">
          <span>{getPartyName(a)}</span>
          <span className="agreement-plus">+</span>
          <span>{getPartyName(b)}</span>
          {editable && (
            <button
              type="button"
              className="ghost danger"
              onClick={() => removeAgreement(a, b)}
            >
              הסר
            </button>
          )}
        </div>
      ))}
    </div>

    {editable && (
      <div className="add-agreement">
        <select value={addAgreementA} onChange={(e) => setAddAgreementA(e.target.value)}>
          <option value="">מפלגה א׳</option>
          {agreementSelectableParties.map((party) => (
            <option key={party} value={party}>
              {getPartyName(party)}
            </option>
          ))}
        </select>
        <select value={addAgreementB} onChange={(e) => setAddAgreementB(e.target.value)}>
          <option value="">מפלגה ב׳</option>
          {agreementSelectableParties
            .filter((party) => party !== addAgreementA)
            .map((party) => (
              <option key={party} value={party}>
                {getPartyName(party)}
              </option>
            ))}
        </select>
        <button type="button" onClick={addAgreement}>
          הוספת הסכם
        </button>
      </div>
    )}

    {editable && !agreementValidation.isValid && (
      <div className="validation-errors">
        {agreementValidation.errors.map((msg) => (
          <div key={msg}>{msg}</div>
        ))}
      </div>
    )}
  </>
);

interface PartyPanelProps {
  editable: boolean;
  isLatestElection: boolean;
  isDemo?: boolean;
  isEdited: boolean;
  parties: PartySummary[];
  mandateParties: PartySummary[];
  blocs: BlocsConfig;
  partyToBloc: Record<string, string | null | undefined>;
  getPartyName: (party: string) => string;
  partySeatDeltas: Record<string, number>;
  normalizedScenario: { voteData: Record<string, { votes: number }> };
  onVoteChange: (party: string, value: string) => void;
  showAllParties: boolean;
  setShowAllParties: (show: boolean) => void;
  showZeroSeatLabel: boolean;
  resetScenario: () => void;
}

export const PartyPanel: React.FC<PartyPanelProps> = ({
  editable,
  isLatestElection,
  isDemo,
  isEdited,
  parties,
  mandateParties,
  blocs,
  partyToBloc,
  getPartyName,
  partySeatDeltas,
  normalizedScenario,
  onVoteChange,
  showAllParties,
  setShowAllParties,
  showZeroSeatLabel,
  resetScenario,
}) => (
  <div className="panel party-panel">
    <div className="panel-head">
      <h2>מפלגות{isDemo && <span className="demo-label"> · נתוני דמה</span>}</h2>
      {editable && isEdited && (
        <button type="button" className="ghost" onClick={resetScenario}>
          איפוס לתוצאות מקור
        </button>
      )}
    </div>
    <PartyBars
      electionNight={isLatestElection}
      editable={editable}
      parties={parties}
      blocs={blocs}
      partyToBloc={partyToBloc}
      maxMandats={mandateParties[0]?.mandats || 0}
      getPartyName={getPartyName}
      partySeatDeltas={partySeatDeltas}
      useCoalitionColors={isLatestElection}
      editableVoteData={normalizedScenario.voteData}
      onVoteChange={onVoteChange}
    />
    <label className="toggle">
      <input
        type="checkbox"
        checked={showAllParties}
        onChange={(event) => setShowAllParties(event.target.checked)}
      />
      <span>
        {showZeroSeatLabel
          ? 'הראה מפלגות ללא מנדטים'
          : 'הראה מפלגות שלא עברו את אחוז החסימה'}
      </span>
    </label>
  </div>
);

interface BottomPanelsProps {
  editable: boolean;
  getPartyName: (party: string) => string;
  scenarioConfig: { agreements?: [string, string][] };
  removeAgreement: (a: string, b: string) => void;
  addAgreementA: string;
  setAddAgreementA: (value: string) => void;
  addAgreementB: string;
  setAddAgreementB: (value: string) => void;
  agreementSelectableParties: string[];
  addAgreement: () => void;
  agreementValidation: { isValid: boolean; errors: string[] };
}

export const BottomPanels: React.FC<BottomPanelsProps> = ({
  editable,
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
  <section className="grid grid-single">
    <div className="panel">
      <h2>הסכמי עודפים</h2>
      <AgreementsPanel
        editable={editable}
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
