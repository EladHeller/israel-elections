import React, { useEffect, useId, useRef, useState } from 'react';
import BlocEditor from './BlocEditor';
import UnassignedParties from './UnassignedParties';
import { computeBlocOverview } from '../lib/bloc-overview';
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
  parties: PartySummary[];
}

function Chamber({ groups, highlighted }: { groups: SeatGroup[]; highlighted: Set<string> }) {
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
              className={`chamber-seat${group ? '' : ' is-vacant'}${highlighted.size && (!group || !highlighted.has(group.key)) ? ' is-dimmed' : ''}`}
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

type Selection = { key: string; combined: boolean };

function BlocFilter({ label, count, delta, colors, pressed, onClick, breakdown }: {
  label: string;
  count: number;
  delta?: number;
  colors: string[];
  pressed: boolean;
  onClick: () => void;
  breakdown?: string;
}) {
  return (
    <button type="button" className={`ui-button ui-button-quiet chamber-filter${breakdown ? ' chamber-filter-combined' : ''}`}
      aria-pressed={pressed} onClick={onClick}>
      <span className="chamber-swatches" aria-hidden="true">
        {colors.length ? colors.map((color, index) =>
          <span key={index} className="chamber-swatch" style={{ '--seat-color': color } as React.CSSProperties} />
        ) : <span className="chamber-swatch chamber-swatch-all" />}
      </span>
      <span>
        {label}
        {breakdown && <small className="chamber-breakdown" dir="ltr">{breakdown}</small>}
      </span>
      <strong>{count}</strong>
      {!!delta && <span dir="ltr" className={`delta-chip ${delta > 0 ? 'gain' : 'lose'}`}>
        {delta > 0 ? `+${delta}` : delta}
      </span>}
    </button>
  );
}

export function BlocsDistributionPanel({
  editable, blocs, blocTotals, blocSeatDeltas, partyToBloc, onPartyBlocChange, getPartyName, mandateParties,
}: BlocsDistributionPanelProps) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const headingId = useId();
  const overview = computeBlocOverview(blocs, blocTotals);
  const groupsByKey = new Map<string, SeatGroup>(
    (blocs.order || Object.keys(blocs.blocks)).map((key) => [key, {
      key,
      label: blocs.blocks[key].label,
      color: blocs.blocks[key].color,
      count: blocTotals[key] || 0,
      delta: blocSeatDeltas[key],
      parties: [],
    }]),
  );
  const unassigned: PartySummary[] = [];
  for (const party of mandateParties) {
    const group = groupsByKey.get(partyToBloc[party.party] ?? '');
    (group?.parties ?? unassigned).push(party);
  }
  const unassignedSeats = unassigned.reduce((sum, party) => sum + party.mandats, 0);
  if (unassignedSeats) {
    groupsByKey.set(unassignedKey, {
      key: unassignedKey, label: 'ללא שיוך', color: '#899bb4', count: unassignedSeats, parties: unassigned,
    });
  }
  const groupedKeys = overview.flatMap(({ key, complementaryKeys }) => [key, ...complementaryKeys]);
  const groups = [...new Set([...groupedKeys, ...groupsByKey.keys()])].map((key) => groupsByKey.get(key)!);
  const selected = selection && groupsByKey.get(selection.key);
  const complementKeys = selection?.combined
    ? overview.find(({ key }) => key === selection.key)?.complementaryKeys ?? []
    : [];
  const highlighted = new Set(selected ? [selected.key, ...complementKeys] : []);
  const activeGroups = groups.filter(({ key }) => highlighted.has(key));
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const activeSeats = activeGroups.reduce((sum, group) => sum + group.count, 0);
  const complementLabels = activeGroups.filter((group) => group !== selected).map(({ label }) => label).join(' ו');
  const majorityLabel = selection?.combined ? 'רוב חוסם' : 'רוב';
  const majorityStatus = selected && selected.key !== unassignedKey
    ? activeSeats >= majority ? `יש ${majorityLabel}` : `חסרים ${majority - activeSeats} ל${majorityLabel}`
    : '';
  const select = (key: string, combined = false) =>
    setSelection((current) => current?.key === key && current.combined === combined ? null : { key, combined });
  const filter = ({ key, label, color, count, delta }: SeatGroup) => (
    <BlocFilter label={label} colors={[color]} count={count} delta={delta}
      pressed={selected && selected.key === key ? !selection?.combined : false} onClick={() => select(key)} />
  );

  return (
    <section className="panel chamber-panel" aria-labelledby={headingId}>
      <div className="chamber-layout">
        <div className="chamber-stage">
          <header className="chamber-heading">
            <h2 id={headingId}>חלוקת גושים</h2>
            <span>כל מושב מייצג מנדט</span>
          </header>
          <div className="chamber-scene">
            <Chamber groups={groups} highlighted={highlighted} />
            <div className="chamber-readout" aria-hidden="true">
              <strong key={selected ? activeSeats : total}>{selected ? activeSeats : total}</strong>
              <span>מנדטים</span>
            </div>
          </div>
          <div className="chamber-scale" role="img" aria-label={`סרגל מנדטים מ־0 עד ${seatCount}, רוב ב־${majority}`}>
            <div className="chamber-scale-track" aria-hidden="true">
              {(selected ? activeGroups : groups).map((group) => (
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
            <BlocFilter label="כל המליאה" colors={[]} count={total} pressed={!selected} onClick={() => setSelection(null)} />
            {overview.map(({ key, complementaryKeys, ownSeats, combinedSeats }) => {
              const group = groupsByKey.get(key)!;
              const complements = complementaryKeys.map((other) => groupsByKey.get(other)!);
              const extraSeats = combinedSeats - ownSeats;
              return (
                <div key={key} className="chamber-bloc">
                  {filter(group)}
                  {complements.length > 0 && (
                    <BlocFilter
                      label={`${combinedSeats >= majority ? 'רוב חוסם עם' : 'עם'} ${complements.map(({ label }) => label).join(' ו')}`}
                      colors={[group.color, ...complements.map(({ color }) => color)]}
                      count={combinedSeats}
                      delta={[group, ...complements].reduce((sum, { delta }) => sum + (delta ?? 0), 0)}
                      breakdown={`${ownSeats} + ${extraSeats}`}
                      pressed={selected === group && selection?.combined === true}
                      onClick={() => select(key, true)}
                    />
                  )}
                </div>
              );
            })}
            {unassignedSeats > 0 && filter(groupsByKey.get(unassignedKey)!)}
          </div>
          <p className="chamber-status" role="status">
            {selected
              ? `${selected.label}${complementLabels ? ` עם ${complementLabels}` : ''} · ${activeSeats} מנדטים`
              : `${total} מתוך ${seatCount} מנדטים חולקו. בחרו גוש להצגת הרשימות.`}
            {majorityStatus && <> · <strong>{majorityStatus}</strong></>}
          </p>
          {selected && (
            <div className="chamber-party-breakdown">
              {activeGroups.map(({ key, label, parties, color }) => (
                <div key={key} className="chamber-party-group" style={{ '--seat-color': color } as React.CSSProperties}>
                  <h3>{activeGroups.length > 1 ? label : 'הרשימות'}</h3>
                  {parties.length ? (
                    <ul aria-label={`מנדטים לפי רשימה: ${label}`}>
                      {parties.map(({ party, mandats }) => (
                        <li key={party}>
                          <span>{getPartyName(party)}</span>
                          <strong>{mandats}</strong>
                        </li>
                      ))}
                    </ul>
                  ) : <p>אין רשימות עם מנדטים</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <UnassignedParties parties={unassigned} getPartyName={getPartyName} />
      {editable && <BlocEditor blocs={blocs} partyToBloc={partyToBloc}
        parties={mandateParties.map(({ party }) => party)} onPartyBlocChange={onPartyBlocChange}
        getPartyName={getPartyName} />}
    </section>
  );
}
