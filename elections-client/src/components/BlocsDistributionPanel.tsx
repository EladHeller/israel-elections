import React, { useEffect, useId, useRef, useState } from 'react';
import BlocEditor from './BlocEditor';
import UnassignedParties from './UnassignedParties';
import type { BlocsConfig } from '../types';
import './BlocsDistributionPanel.css';

const seatCount = 120;
const majority = 61;
const unassignedKey = 'unassigned';
const seatRows = [10, 14, 18, 22, 26, 30];
const centerX = 300;
const floorY = 196;
const pitch = 0.56;

const seats = seatRows.flatMap((count, row) => {
  const radius = 112 + row * 28;
  return Array.from({ length: count }, (_, column) => {
    const angle = 0.055 + column / (count - 1) * (Math.PI - 0.11);
    return {
      id: `${row}-${column}`,
      x: centerX + Math.cos(angle) * radius,
      y: floorY - Math.sin(angle) * radius * pitch,
      angle,
      row,
    };
  });
});

// Fill each bloc as a continuous wedge, then paint the back rows first.
const paintOrder = seats.sort((a, b) => a.angle - b.angle || b.row - a.row)
  .map((seat, index) => ({ ...seat, index }))
  .sort((a, b) => b.row - a.row);

function terrace(radius: number, offset = 0) {
  const y = floorY + offset;
  return `M ${centerX - radius} ${y} A ${radius} ${radius * pitch} 0 0 1 ${centerX + radius} ${y}`;
}

interface SeatGroup {
  key: string;
  label: string;
  count: number;
  color: string;
  delta?: number;
}

function Chamber({ groups, selected }: { groups: SeatGroup[]; selected: SeatGroup | undefined }) {
  const lightId = useId();
  const mapRef = useRef<SVGSVGElement>(null);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof IntersectionObserver === 'undefined') {
      setHasEntered(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setHasEntered(true);
      observer.disconnect();
    }, { threshold: 0.25 });
    observer.observe(map);
    return () => observer.disconnect();
  }, []);

  const allocations = groups.flatMap((group) => Array<SeatGroup>(group.count).fill(group));

  return (
    <svg ref={mapRef} className={`chamber-map${hasEntered ? ' has-entered' : ''}`} viewBox="0 0 600 235" aria-hidden="true">
      <defs>
        <linearGradient id={lightId} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fff" stopOpacity=".28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="chamber-floor-edge" d={terrace(270, 8)} />
      <path className="chamber-floor" d={terrace(270)} />
      {[98, 126, 154, 182, 210, 238, 268].map((radius) =>
        <path key={radius} className="chamber-terrace" d={terrace(radius)} />)}
      <path className="chamber-floor-line" d="M30 196H191 M409 196H570" />
      {paintOrder.map(({ id, x, y, angle, row, index }) => {
        const group = allocations[index];
        return (
          <g key={id} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
            <g
              className={`chamber-seat${group ? '' : ' is-vacant'}${selected && selected.key !== group?.key ? ' is-dimmed' : ''}`}
              style={{
                '--seat-color': group?.color,
                '--seat-delay': `${(5 - row) * 63 + (1 - Math.sin(angle)) * 240}ms`,
              } as React.CSSProperties}
            >
              <ellipse className="chamber-seat-shadow" cy="5" rx="9.5" ry="5.5" />
              <ellipse className="chamber-seat-base" cy="3" rx="8.2" ry="5.2" />
              <ellipse className="chamber-seat-top" rx="8.2" ry="5.2" />
              <ellipse className="chamber-seat-light" rx="8.2" ry="5.2" fill={`url(#${lightId})`} />
            </g>
          </g>
        );
      })}
    </svg>
  );
}

interface PartySummary {
  party: string;
  votes: number;
  mandats: number;
}

interface BlocsDistributionPanelProps {
  editable: boolean;
  blocs: BlocsConfig;
  blocTotals: Record<string, number>;
  blocSeatDeltas: Record<string, number>;
  partyToBloc: Record<string, string | null | undefined>;
  onPartyBlocChange: (party: string, blocKey: string | null) => void;
  getPartyName: (party: string) => string;
  mandateParties: PartySummary[];
}

export function BlocsDistributionPanel({
  editable, blocs, blocTotals, blocSeatDeltas, partyToBloc, onPartyBlocChange, getPartyName, mandateParties,
}: BlocsDistributionPanelProps) {
  const [selection, setSelection] = useState<string | null>(null);
  const headingId = useId();
  const unassigned = mandateParties.filter(({ party }) => !partyToBloc[party]);
  const unassignedSeats = unassigned.reduce((sum, party) => sum + party.mandats, 0);
  const groups: SeatGroup[] = (blocs.order || Object.keys(blocs.blocks)).map((key) => ({
    key,
    label: blocs.blocks[key].label,
    color: blocs.blocks[key].color,
    count: blocTotals[key] || 0,
    delta: blocSeatDeltas[key],
  }));
  if (unassignedSeats) {
    groups.push({ key: unassignedKey, label: 'ללא שיוך', color: '#899bb4', count: unassignedSeats });
  }
  const selected = groups.find(({ key }) => key === selection);
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const majorityStatus = selected && selected.key !== unassignedKey
    ? selected.count >= majority ? 'יש רוב' : `חסרים ${majority - selected.count} לרוב`
    : '';

  return (
    <section className="panel chamber-panel" aria-labelledby={headingId}>
      <div className="chamber-layout">
        <div className="chamber-stage">
          <header className="chamber-heading">
            <h2 id={headingId}>חלוקת גושים</h2>
            <span>כל מושב מייצג מנדט</span>
          </header>
          <div className="chamber-scene">
            <Chamber groups={groups} selected={selected} />
            <div className="chamber-readout" aria-hidden="true">
              <strong key={selected?.count ?? total}>{selected?.count ?? total}</strong>
              <span>מנדטים</span>
            </div>
          </div>
          <div className="chamber-scale" role="img" aria-label={`סרגל מנדטים מ־0 עד ${seatCount}, רוב ב־${majority}`}>
            <div className="chamber-scale-track" aria-hidden="true">
              {(selected ? [selected] : groups).map((group) => (
                <span key={group.key}
                  style={{ '--seat-color': group.color, width: `${group.count / seatCount * 100}%` } as React.CSSProperties} />
              ))}
              <i style={{ insetInlineStart: `${majority / seatCount * 100}%` }} />
            </div>
            <div className="chamber-scale-labels" aria-hidden="true">
              <span>0</span>
              <span style={{ insetInlineStart: `${majority / seatCount * 100}%` }}>{majority} לרוב</span>
              <span>{seatCount}</span>
            </div>
          </div>
        </div>
        <div className="chamber-controls">
          <div className="chamber-filters" role="group" aria-label="בחירת גוש במליאה">
            <button type="button" className="ui-button ui-button-quiet chamber-filter"
              aria-pressed={!selected} onClick={() => setSelection(null)}>
              <span className="chamber-swatch chamber-swatch-all" />
              <span>כל המליאה</span>
              <strong>{total}</strong>
            </button>
            {groups.map(({ key, label, color, count, delta }) => (
              <button key={key} type="button" className="ui-button ui-button-quiet chamber-filter"
                aria-pressed={selected?.key === key}
                onClick={() => setSelection(selected?.key === key ? null : key)}>
                <span className="chamber-swatch" style={{ '--seat-color': color } as React.CSSProperties} />
                <span>{label}</span>
                <strong>{count}</strong>
                {!!delta && <span dir="ltr" className={`delta-chip ${delta > 0 ? 'gain' : 'lose'}`}>
                  {delta > 0 ? `+${delta}` : delta}
                </span>}
              </button>
            ))}
          </div>
          <p className="chamber-status" role="status">
            {selected ? `${selected.label} · ${selected.count} מנדטים` : `${total} מתוך ${seatCount} מנדטים חולקו`}
            {majorityStatus && <> · <strong>{majorityStatus}</strong></>}
          </p>
        </div>
      </div>
      <UnassignedParties parties={unassigned} getPartyName={getPartyName} />
      {editable && <BlocEditor blocs={blocs} partyToBloc={partyToBloc}
        parties={mandateParties.map(({ party }) => party)} onPartyBlocChange={onPartyBlocChange}
        getPartyName={getPartyName} />}
    </section>
  );
}
