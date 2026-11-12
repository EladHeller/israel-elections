import React from 'react';
import {
  THRESHOLD_PROXIMITY,
  type computeProximity,
} from '../lib/proximity';
import { numberFormat, percentageFormat } from '../lib/ui-helpers';
import MandateMargins from './MandateMargins';

const percentFormat = percentageFormat;
const percent = (share: number) => `${percentFormat.format(share * 100)}%`;

interface Props {
  proximity: ReturnType<typeof computeProximity>;
  blockPercentage: number;
  getPartyName: (party: string) => string;
  isCounting: boolean;
  onVoteDelta?: (party: string, delta: number) => void;
  supportingContent?: React.ReactNode;
}

export default function CloseRacesSection({
  proximity, blockPercentage, getPartyName, isCounting, onVoteDelta, supportingContent,
}: Props) {
  const { thresholdRaces, seatRaces, seatLimit } = proximity;
  const axisStart = Math.max(0, blockPercentage - THRESHOLD_PROXIMITY);
  const axisEnd = Math.min(1, blockPercentage + THRESHOLD_PROXIMITY);
  const position = (share: number) => `${(share - axisStart) / (axisEnd - axisStart) * 100}%`;

  const thresholdPanel = (
    <div className="panel">
      <h2>קרובות לאחוז החסימה</h2>
      <p className="close-races-subtitle">אחוז החסימה: {percent(blockPercentage)}</p>
      {blockPercentage === 0 ? (
        <p className="close-races-empty">אין אחוז חסימה בתרחיש הזה.</p>
      ) : thresholdRaces.length === 0 ? (
        <p className="close-races-empty">אין רשימות קרובות לאחוז החסימה.</p>
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
  );

  return (
    <section className="close-races-section" aria-label="קרובות לאחוז החסימה ולשינוי מנדט">
      {isCounting && <p className="close-races-counting">לפי הקולות שנספרו עד כה</p>}
      <div className="grid">
        {supportingContent ? <div className="close-races-context">{thresholdPanel}{supportingContent}</div> : thresholdPanel}
        <MandateMargins races={seatRaces} limit={seatLimit} getPartyName={getPartyName} onVoteDelta={onVoteDelta} />
      </div>
    </section>
  );
}
