import React from 'react';
import BlocEditor from './BlocEditor';
import UnassignedParties from './UnassignedParties';
import type { BlocsConfig, ResultsMap } from '../types';
import { computeBlocOverview } from '../lib/bloc-overview';

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
  isDemo?: boolean;
}

export default function BlocsOverview({ blocs, totals, deltas, parties, results, partyToBloc,
  getPartyName, onAssign, onRename, onReset, customized, saveFailed, hasResults,
  isCounting, isSimulator, isDemo }: Props) {
  const order = blocs.order || Object.keys(blocs.blocks);
  const overview = computeBlocOverview(blocs, totals);
  const assigned = parties.some((party) => partyToBloc[party]);
  const unassigned = parties.filter((party) => !partyToBloc[party]);
  const visibleUnassigned = unassigned.filter((party) => !hasResults || results[party]?.mandats > 0);

  return (
    <section className="panel blocs-overview" aria-label="תמונת הגושים">
      <div className="bloc-heading">
        <h2>תמונת הגושים</h2>
        <span>{isDemo ? (isSimulator ? 'סימולציה · נתוני דמה' : 'נתוני דמה') : isSimulator ? 'סימולציה' : isCounting ? 'לפי הספירה הנוכחית' : 'הרכב הגושים'}
          {customized && ' · חלוקה אישית'}</span>
      </div>
      {assigned ? (
        <>
          <div className="bloc-scoreboard" style={{ '--bloc-count': overview.length } as React.CSSProperties}>
            {overview.map(({ key, complementaryKeys, ownSeats, combinedSeats, majorityText }) => {
              const bloc = blocs.blocks[key];
              const delta = deltas[key] || 0;
              const segments = [key, ...complementaryKeys];
              const chartDescription = segments.map((segment) => `${blocs.blocks[segment].label}: ${totals[segment] || 0}`).join(', ');
              return (
                <div className="bloc-score" key={key} style={{ '--bloc-color': bloc.color } as React.CSSProperties}>
                  <h3><span className="bloc-color" />{bloc.label}</h3>
                  <div className="bloc-totals">
                    <div className="bloc-number">
                      <strong>{hasResults ? ownSeats : '—'}</strong>
                      {hasResults && <span>מנדטים</span>}
                      {hasResults && delta !== 0 && <span dir="ltr" className={`delta-chip ${delta > 0 ? 'gain' : 'lose'}`}
                        aria-label={`${delta > 0 ? 'תוספת' : 'ירידה של'} ${Math.abs(delta)} מנדטים ${isSimulator ? 'לעומת התוצאות' : 'מהעדכון הקודם'}`}>
                        {delta > 0 ? '+' : '−'}{Math.abs(delta)}
                      </span>}
                    </div>
                    {complementaryKeys.map((other) => (
                      <div className="bloc-complement" key={other}>
                        <div className="bloc-complement-value">
                          <span aria-hidden="true">+</span>
                          <strong>{hasResults ? totals[other] || 0 : '—'}</strong>
                          {hasResults && !!deltas[other] && <span dir="ltr" className={`delta-chip ${deltas[other] > 0 ? 'gain' : 'lose'}`}
                            aria-label={`שינוי של ${deltas[other]} מנדטים ${isSimulator ? 'לעומת התוצאות' : 'מהעדכון הקודם'}`}>
                            {deltas[other] > 0 ? '+' : '−'}{Math.abs(deltas[other])}
                          </span>}
                        </div>
                        <span className="bloc-complement-label"><span className="bloc-color" style={{ '--bloc-color': blocs.blocks[other].color } as React.CSSProperties} />{blocs.blocks[other].label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bloc-outcome">
                  {hasResults && <>
                    <div className="majority-track" role="img" aria-label={`${chartDescription}. סך הכול ${combinedSeats} מתוך 120 מנדטים, רוב ב־61`}>
                      {segments.map((segment) => <div key={segment}
                        style={{ width: `${Math.min(totals[segment] || 0, 120) / 120 * 100}%`, '--bloc-color': blocs.blocks[segment].color } as React.CSSProperties} />)}
                      <span className="majority-marker" />
                    </div>
                    <div className="majority-caption">
                      {complementaryKeys.length > 0 && <span>יחד: {combinedSeats} מנדטים</span>}
                      <span>61 לרוב</span>
                    </div>
                    <p className="majority-status" aria-label={majorityText} title={majorityText}>
                      {ownSeats >= 61 ? 'יש רוב' : combinedSeats >= 61 ? 'רוב חוסם יחד' : majorityText}
                    </p>
                  </>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : <p className="bloc-empty">טרם הוגדרה חלוקה לגושים. אפשר לבחור את המפלגות בכל גוש.</p>}

      <UnassignedParties parties={visibleUnassigned.map((party) => ({ party, mandats: results[party]?.mandats || 0 }))}
        getPartyName={getPartyName} hasResults={hasResults} />

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
          <BlocEditor blocs={blocs} parties={parties} partyToBloc={partyToBloc}
            onPartyBlocChange={onAssign} getPartyName={getPartyName} />
          <div className="bloc-settings-footer">
            <span role="status">{saveFailed ? 'לא ניתן לשמור במכשיר הזה. הבחירה תקפה לביקור הנוכחי.' : 'שינויים נשמרים במכשיר הזה, לכנסת הנבחרת.'}</span>
            {customized && <button type="button" className="ghost" onClick={onReset}>איפוס החלוקה האישית</button>}
          </div>
        </div>
      </details>
    </section>
  );
}
