import React from 'react';
import type { BlocsConfig, ResultsMap } from '../types';

interface Props {
  blocs: BlocsConfig;
  totals: Record<string, number>;
  deltas: Record<string, number>;
  parties: string[];
  results: ResultsMap;
  partyToBloc: Record<string, string | null>;
  getPartyName: (party: string) => string;
  onAssign: (party: string, bloc: string | null) => void;
  onRename: (bloc: string, label: string) => void;
  onReset: () => void;
  customized: boolean;
  saveFailed: boolean;
  hasResults: boolean;
  isCounting?: boolean;
  isSimulator?: boolean;
}

export default function BlocsOverview({ blocs, totals, deltas, parties, results, partyToBloc,
  getPartyName, onAssign, onRename, onReset, customized, saveFailed, hasResults,
  isCounting, isSimulator }: Props) {
  const order = blocs.order || Object.keys(blocs.blocks);
  const assigned = parties.some((party) => partyToBloc[party]);
  const unassigned = parties.filter((party) => !partyToBloc[party]);
  const unassignedSeats = unassigned.reduce((sum, party) => sum + (results[party]?.mandats || 0), 0);

  return (
    <section className="blocs-overview" aria-label="תמונת הגושים">
      <div className="bloc-heading">
        <h2>תמונת הגושים</h2>
        <span>{isSimulator ? 'סימולציה' : isCounting ? 'לפי הספירה הנוכחית' : 'הרכב הגושים'}
          {customized && ' · חלוקה אישית'}</span>
      </div>
      {assigned ? (
        <>
          <div className="bloc-scoreboard" style={{ '--bloc-count': order.length } as React.CSSProperties}>
            {order.map((key) => {
              const bloc = blocs.blocks[key];
              const members = parties.filter((party) => partyToBloc[party] === key);
              const total = totals[key] || 0;
              const delta = deltas[key] || 0;
              return (
                <div className="bloc-score" key={key} style={{ '--bloc-color': bloc.color } as React.CSSProperties}>
                  <h3><span className="bloc-color" />{bloc.label}</h3>
                  <div className="bloc-number">
                    <strong>{hasResults ? total : '—'}</strong>
                    {hasResults && <span>מנדטים</span>}
                    {hasResults && delta !== 0 && <span dir="ltr" className={`delta-chip ${delta > 0 ? 'gain' : 'lose'}`}
                      aria-label={`${delta > 0 ? 'תוספת' : 'ירידה של'} ${Math.abs(delta)} מנדטים ${isSimulator ? 'לעומת התוצאות' : 'מהעדכון הקודם'}`}>
                      {delta > 0 ? '+' : '−'}{Math.abs(delta)}
                    </span>}
                  </div>
                  {hasResults && <>
                    <div className="majority-track" role="img" aria-label={`${bloc.label}: ${total} מתוך 120 מנדטים, רוב ב־61`}>
                      <div style={{ width: `${Math.min(total, 120) / 120 * 100}%` }} />
                      <span className="majority-marker" />
                    </div>
                    <div className="majority-caption"><span>{total >= 61 ? 'רוב בכנסת' : `עוד ${61 - total} לרוב`}</span><span>61 לרוב</span></div>
                  </>}
                  <p className="bloc-members">{members.length ? members.map(getPartyName).join(' · ') : 'אין מפלגות משויכות'}</p>
                </div>
              );
            })}
          </div>
          {unassigned.length > 0 && <div className="unassigned-summary">
            <strong>ללא שיוך{hasResults ? ` · ${unassignedSeats} מנדטים` : ''}</strong>
            <span>{unassigned.filter((party) => !hasResults || results[party]?.mandats > 0).map(getPartyName).join(' · ')}</span>
          </div>}
        </>
      ) : <p className="bloc-empty">טרם הוגדרה חלוקה לגושים. אפשר לבחור את המפלגות בכל גוש.</p>}

      <details className="bloc-settings">
        <summary>{assigned ? 'עריכת הגושים' : 'הגדרת הגושים'}</summary>
        <div className="bloc-settings-body">
          <div className="bloc-name-fields" style={{ '--bloc-count': order.length } as React.CSSProperties}>
            {order.map((key) => <label key={key}>שם {blocs.blocks[key].label}
              <input key={blocs.blocks[key].label} aria-label={`שם ${blocs.blocks[key].label}`}
                maxLength={40} defaultValue={blocs.blocks[key].label}
                onBlur={(event) => onRename(key, event.target.value)} />
            </label>)}
          </div>
          <div className="bloc-assignments">
            {parties.map((party) => <label className="bloc-assignment" key={party}>
              <span>{getPartyName(party)}</span>
              <select aria-label={`שיוך ${getPartyName(party)} לגוש`} value={partyToBloc[party] || ''}
                onChange={(event) => onAssign(party, event.target.value || null)}>
                <option value="">ללא שיוך</option>
                {order.map((key) => <option key={key} value={key}>{blocs.blocks[key].label}</option>)}
              </select>
            </label>)}
          </div>
          <div className="bloc-settings-footer">
            <span role="status">{saveFailed ? 'לא ניתן לשמור במכשיר הזה. הבחירה תקפה לביקור הנוכחי.' : 'שינויים נשמרים במכשיר הזה, לכנסת הנבחרת.'}</span>
            {customized && <button type="button" className="ghost" onClick={onReset}>איפוס החלוקה האישית</button>}
          </div>
        </div>
      </details>
    </section>
  );
}
