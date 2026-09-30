import React, { useId, useState } from 'react';
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
}

const SeatTable = ({ races, limit, getPartyName }: {
  races: SeatRace[];
  limit: number;
  getPartyName: Props['getPartyName'];
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
          <td><span className={isCloseSeatMargin(race.gain, limit) ? 'close-seat-value' : ''}>
            {race.gain === null ? '—' : numberFormat.format(race.gain)}
          </span></td>
          <td><span className={isCloseSeatMargin(race.lose, limit) ? 'close-seat-value' : ''}>
            {race.lose === null ? '—' : numberFormat.format(race.lose)}
          </span>
          {race.loseCrossesThreshold && (
            <span className="close-threshold-loss">ירידה מתחת לאחוז החסימה</span>
          )}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export default function CloseRacesSection({
  proximity, blockPercentage, getPartyName, isCounting,
}: Props) {
  const [showAllParties, setShowAllParties] = useState(false);
  const seatListId = useId();
  const { thresholdRaces, seatRaces, closeSeatRaces, seatLimit } = proximity;
  const visibleSeatRaces = showAllParties ? seatRaces : closeSeatRaces;
  const axisStart = Math.max(0, blockPercentage - THRESHOLD_PROXIMITY);
  const axisEnd = Math.min(1, blockPercentage + THRESHOLD_PROXIMITY);
  const position = (share: number) => `${(share - axisStart) / (axisEnd - axisStart) * 100}%`;

  return (
    <section className="close-races-section" aria-labelledby="close-races-title">
      <div className="close-races-heading">
        <h2 id="close-races-title">על הסף</h2>
        {isCounting && <p>לפי הקולות שנספרו עד כה</p>}
      </div>
      <div className="grid">
        <div className="panel">
          <h3>קרובות לאחוז החסימה</h3>
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
          <h3>קרובות לשינוי מנדט</h3>
          <p className="close-races-subtitle">עד 10% ממודד המנדט · עד {numberFormat.format(seatLimit)} קולות</p>
          <div id={seatListId}>
            {visibleSeatRaces.length === 0 ? (
              <p className="close-races-empty">אין מפלגות במרחק של עד 10% ממודד המנדט משינוי.</p>
            ) : (
              <SeatTable races={visibleSeatRaces} limit={seatLimit} getPartyName={getPartyName} />
            )}
          </div>
          {seatRaces.length > closeSeatRaces.length && (
            <button type="button" className="close-races-toggle"
              aria-expanded={showAllParties} aria-controls={seatListId}
              onClick={() => setShowAllParties((showAll) => !showAll)}>
              {showAllParties ? 'הצג פחות' : `הצג את כל המפלגות (${seatRaces.length})`}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
