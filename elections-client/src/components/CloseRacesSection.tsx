import React from 'react';
import {
  isCloseSeatMargin,
  THRESHOLD_PROXIMITY,
  type computeProximity,
  type SeatRace,
} from '../lib/proximity';
import { numberFormat } from '../lib/ui-helpers';

const percentFormat = new Intl.NumberFormat('he-IL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});
const percent = (share: number) => `${percentFormat.format(share * 100)}%`;

interface Props {
  proximity: ReturnType<typeof computeProximity>;
  blockPercentage: number;
  getPartyName: (party: string) => string;
  isCounting: boolean;
  onVoteDelta?: (party: string, delta: number) => void;
}

const SeatMarginValue = ({ party, partyName, margin, direction, limit, onVoteDelta }: {
  party: string;
  partyName: string;
  margin: number | null;
  direction: 'gain' | 'loss';
  limit: number;
  onVoteDelta: Props['onVoteDelta'];
}) => {
  const className = `close-seat-${direction}${isCloseSeatMargin(margin, limit) ? ' close-seat-value' : ''}`;
  const value = margin === null ? '—' : `${direction === 'gain' ? '+' : '−'}${numberFormat.format(margin)}`;

  if (margin === null || !onVoteDelta) {
    return <span dir="ltr" className={className}>{value}</span>;
  }

  const label = `${direction === 'gain' ? 'הוסף' : 'הפחת'} ${numberFormat.format(margin)} קולות ${direction === 'gain' ? 'ל' : 'מ'}${partyName}`;
  return (
    <button type="button" dir="ltr" className={`close-seat-action ${className}`}
      aria-label={label} title={label}
      onClick={() => onVoteDelta(party, direction === 'gain' ? margin : -margin)}>
      {value}
    </button>
  );
};

const SeatTable = ({ races, limit, getPartyName, onVoteDelta }: {
  races: SeatRace[];
  limit: number;
  getPartyName: Props['getPartyName'];
  onVoteDelta: Props['onVoteDelta'];
}) => (
  <table className="close-seat-table" aria-label="מרחק בקולות מהשגת מנדט ומאיבוד מנדט">
    <thead>
      <tr><th scope="col">מפלגה</th><th scope="col">מנדטים</th>
        <th scope="col">להשגת מנדט</th><th scope="col">לאיבוד מנדט</th></tr>
    </thead>
    <tbody>
      {races.map((race) => (
        <tr key={race.party}>
          <th scope="row">{getPartyName(race.party)}</th>
          <td>{numberFormat.format(race.mandats)}</td>
          <td><SeatMarginValue party={race.party} partyName={getPartyName(race.party)}
            margin={race.gain} direction="gain" limit={limit} onVoteDelta={onVoteDelta} /></td>
          <td><SeatMarginValue party={race.party} partyName={getPartyName(race.party)}
            margin={race.lose} direction="loss" limit={limit} onVoteDelta={onVoteDelta} />
          {race.loseCrossesThreshold && (
            <span className="close-threshold-loss">ירידה מתחת לאחוז החסימה</span>
          )}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export default function CloseRacesSection({
  proximity, blockPercentage, getPartyName, isCounting, onVoteDelta,
}: Props) {
  const { thresholdRaces, seatRaces, seatLimit } = proximity;
  const axisStart = Math.max(0, blockPercentage - THRESHOLD_PROXIMITY);
  const axisEnd = Math.min(1, blockPercentage + THRESHOLD_PROXIMITY);
  const position = (share: number) => `${(share - axisStart) / (axisEnd - axisStart) * 100}%`;

  return (
    <section className="close-races-section" aria-label="קרובות לאחוז החסימה ולשינוי מנדט">
      {isCounting && <p className="close-races-counting">לפי הקולות שנספרו עד כה</p>}
      <div className="grid">
        <div className="panel">
          <h2>קרובות לאחוז החסימה</h2>
          <p className="close-races-subtitle">אחוז החסימה: {percent(blockPercentage)}</p>
          {blockPercentage === 0 ? (
            <p className="close-races-empty">אין אחוז חסימה בתרחיש הזה.</p>
          ) : thresholdRaces.length === 0 ? (
            <p className="close-races-empty">אין מפלגות קרובות לאחוז החסימה.</p>
          ) : (
            <>
              <div className="close-threshold-axis" aria-hidden="true">
                <span>{percent(axisStart)}</span><span>{percent(axisEnd)}</span>
              </div>
              <div className="close-threshold-list">
                {thresholdRaces.map((race) => (
                  <div key={race.party} className="close-threshold-row">
                    <div className="close-threshold-meta">
                      <strong>{getPartyName(race.party)}</strong>
                      <span>{percent(race.share)}</span>
                    </div>
                    <div className="close-threshold-track" aria-hidden="true">
                      <span className="close-threshold-marker" style={{ left: position(blockPercentage) }} />
                      <span className={`close-threshold-dot ${race.gapVotes < 0 ? 'below' : 'above'}`}
                        style={{ left: position(race.share) }} />
                    </div>
                    <div className="close-threshold-detail">
                      <span>{percentFormat.format(Math.abs(race.gapPercentagePoints))} נק׳ אחוז ·{' '}
                        {race.gapVotes === 0 ? 'באחוז החסימה'
                          : `${numberFormat.format(Math.abs(race.gapVotes))} קולות ${race.gapVotes < 0
                            ? 'מתחת לאחוז החסימה' : 'מעל אחוז החסימה'}`}</span>
                      {race.veryClose && <span className="close-race-badge">קרובה מאוד</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="panel">
          <h2>קרובות לשינוי מנדט</h2>
          <p className="close-races-subtitle">מודגשים: עד 10% ממודד המנדט · עד {numberFormat.format(seatLimit)} קולות</p>
          <div>
            {seatRaces.length === 0 ? (
              <p className="close-races-empty">אין מפלגות להצגה.</p>
            ) : (
              <SeatTable races={seatRaces} limit={seatLimit} getPartyName={getPartyName}
                onVoteDelta={onVoteDelta} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
