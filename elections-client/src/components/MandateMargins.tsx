import React, { useState } from 'react';
import { isCloseSeatMargin, type SeatRace } from '../lib/proximity';
import { numberFormat } from '../lib/ui-helpers';

type Direction = 'gain' | 'lose';
type Order = 'closest' | Direction;

interface Props {
  races: SeatRace[];
  limit: number;
  getPartyName: (party: string) => string;
  onVoteDelta?: (party: string, delta: number) => void;
}

const orders: { key: Order; label: string }[] = [
  { key: 'closest', label: 'הכי קרובות' },
  { key: 'gain', label: 'לתוספת' },
  { key: 'lose', label: 'לאובדן' },
];
const distance = (race: SeatRace, order: Order): number => order === 'closest'
  ? Math.min(race.gain ?? Infinity, race.lose ?? Infinity)
  : race[order] ?? Infinity;

function MarginCell({ race, partyName, direction, scale, limit, order, onVoteDelta }: {
  race: SeatRace;
  partyName: string;
  direction: Direction;
  scale: number;
  limit: number;
  order: Order;
  onVoteDelta: Props['onVoteDelta'];
}) {
  const margin = race[direction];
  const gain = direction === 'gain';
  const formatted = margin === null ? '—' : `${gain ? '+' : '−'}${numberFormat.format(margin)}`;
  const value = <>
    <bdi dir="ltr">{formatted}</bdi>
    <span className="mandate-margin-track" aria-hidden="true">
      {margin !== null && <span className="mandate-margin-bar" key={order}
        style={{ '--margin-width': `${margin / scale * 100}%` } as React.CSSProperties} />}
    </span>
  </>;
  const close = isCloseSeatMargin(margin, limit);
  return (
    <td className="mandate-margin-cell" data-direction={direction} data-close={close}>
      {margin !== null && onVoteDelta ? (
        <button type="button" className="ui-button ui-button-quiet mandate-margin-value"
          aria-label={`${gain ? 'הוסף' : 'הפחת'} ${numberFormat.format(margin)} קולות ${gain ? 'ל' : 'מ'}${partyName}`}
          onClick={() => onVoteDelta(race.party, gain ? margin : -margin)}>
          {value}
        </button>
      ) : <span className="mandate-margin-value">{value}</span>}
      {!gain && race.loseCrossesThreshold && (
        <span className="mandate-threshold-loss">ירידה מתחת לאחוז החסימה</span>
      )}
    </td>
  );
}

export default function MandateMargins({ races, limit, getPartyName, onVoteDelta }: Props) {
  const [order, setOrder] = useState<Order>('closest');
  if (!races.length) return (
    <div className="panel mandate-margins">
      <h2>קרובות לשינוי מנדט</h2>
      <p className="close-races-empty">אין רשימות להצגה.</p>
    </div>
  );

  const ranked = [...races].sort((a, b) => distance(a, order) - distance(b, order));
  const lead = ranked[0];
  const leadDirection = order === 'closest'
    ? (distance(lead, 'gain') <= distance(lead, 'lose') ? 'gain' : 'lose')
    : order;
  const leadDistance = lead[leadDirection];
  const scale = Math.max(1, limit, ...races.flatMap(race => [race.gain ?? 0, race.lose ?? 0]));
  const axisStyle = { '--close-width': `${limit / scale * 100}%` } as React.CSSProperties;

  return (
    <div className="panel mandate-margins">
      <h2>קרובות לשינוי מנדט</h2>
      <div className="mandate-margin-order" role="group" aria-label="מיון לפי מרחק משינוי מנדט">
        {orders.map(({ key, label }) => (
          <button type="button" className="ui-button ui-button-quiet" key={key}
            aria-pressed={key === order} onClick={() => setOrder(key)}>{label}</button>
        ))}
      </div>
      <div className="mandate-margin-lead" data-direction={leadDirection} aria-live="polite">
        {leadDistance === null ? <p>אין מרחק מחושב בכיוון הזה.</p> : (
          <>
            <div>
              <strong>{getPartyName(lead.party)}</strong>
              <p>{leadDirection === 'gain' ? 'קולות נוספים למנדט' : 'קולות פחות לאיבוד מנדט'}</p>
            </div>
            <bdi dir="ltr" className="mandate-margin-readout" key={`${lead.party}:${leadDirection}`}>
              {leadDirection === 'gain' ? '+' : '−'}{numberFormat.format(leadDistance)}
            </bdi>
          </>
        )}
      </div>
      <p className="mandate-margin-legend"><span aria-hidden="true" />קרובות במיוחד · עד <bdi>{numberFormat.format(limit)}</bdi> קולות (10% ממודד המנדט)</p>
      <table className="mandate-margin-table" dir="rtl" style={axisStyle}
        aria-label="מרחק בקולות מהשגת מנדט ומאיבוד מנדט">
        <thead>
          <tr>
            <th scope="col">רשימה</th>
            <th scope="col">לתוספת מנדט</th>
            <th scope="col">לאיבוד מנדט</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map(race => {
            const partyName = getPartyName(race.party);
            return (
              <tr key={race.party} data-leading={race.party === lead.party && leadDistance !== null}>
                <th scope="row">
                  <strong>{partyName}</strong>
                  <span><bdi>{numberFormat.format(race.mandats)}</bdi> מנדטים</span>
                </th>
                <MarginCell race={race} partyName={partyName} direction="gain" scale={scale} limit={limit}
                  order={order} onVoteDelta={onVoteDelta} />
                <MarginCell race={race} partyName={partyName} direction="lose" scale={scale} limit={limit}
                  order={order} onVoteDelta={onVoteDelta} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
