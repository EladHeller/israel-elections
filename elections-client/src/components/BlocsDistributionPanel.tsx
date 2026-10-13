import React, { useEffect } from 'react';
import type { BlocsConfig } from '../types';

interface DeltaChipProps {
  delta?: number | null;
}

const DeltaChip: React.FC<DeltaChipProps> = ({ delta }) => {
  if (!delta) return null;
  return (
    <span className={`delta-chip ${delta > 0 ? 'gain' : 'lose'}`}>
      {delta > 0 ? `+${delta}` : delta}
    </span>
  );
};

interface DonutProps {
  data: number[];
  total: number;
  colors: string[];
  labels: string[];
}

const Donut: React.FC<DonutProps> = ({ data, total, colors, labels }) => {
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
        stroke="var(--chart-track)"
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
            className="donut-segment"
            style={{ '--chart-color': colors[i] } as React.CSSProperties}
            strokeWidth={stroke}
            strokeDasharray={dash}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        );
      })}
      <text x="110" y="106" textAnchor="middle" className="donut-value">
        {total}
      </text>
      <text x="110" y="130" textAnchor="middle" className="donut-label">
        מנדטים
      </text>
    </svg>
  );
};

interface BlocLegendProps {
  blocs: BlocsConfig;
  totals: Record<string, number>;
  deltas: Record<string, number>;
}

const BlocLegend: React.FC<BlocLegendProps> = ({ blocs, totals, deltas }) => (
  <div className="legend">
    {blocs.order?.map((key) => (
      <div key={key} className="legend-item">
        <span
          className="legend-swatch"
          style={{ '--chart-color': blocs.blocks[key].color } as React.CSSProperties}
        />
        <span>{blocs.blocks[key].label}</span>
        <span className="legend-value">
          {totals[key] || 0}
          <DeltaChip delta={deltas[key]} />
        </span>
      </div>
    ))}
  </div>
);

interface PartySummary {
  party: string;
  votes: number;
  mandats: number;
}

interface BlocEditorProps {
  blocs: BlocsConfig;
  partyToBloc: Record<string, string | null | undefined>;
  parties: PartySummary[];
  onPartyBlocChange: (party: string, blocKey: string | null) => void;
  getPartyName: (party: string) => string;
}

const BlocEditor: React.FC<BlocEditorProps> = ({
  blocs,
  partyToBloc,
  parties,
  onPartyBlocChange,
  getPartyName,
}) => {
  const editableParties = parties || [];
  const [draggedParty, setDraggedParty] = React.useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = React.useState<string | null>(null);
  const [selectedParty, setSelectedParty] = React.useState<string | null>(null);
  const [touchSelectionMode, setTouchSelectionMode] = React.useState(false);
  const [isTouchDevice, setIsTouchDevice] = React.useState(false);
  const touchPartyRef = React.useRef<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)');
    const update = () => setIsTouchDevice(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  if (editableParties.length === 0) return null;

  const [gushAKey, gushBKey] = blocs.order || Object.keys(blocs.blocks);

  const groupA = editableParties.filter((p) => partyToBloc[p.party] === gushAKey);
  const groupB = editableParties.filter((p) => partyToBloc[p.party] === gushBKey);
  const unassigned = editableParties.filter(
    (p) =>
      !partyToBloc[p.party] || ![gushAKey, gushBKey].includes(partyToBloc[p.party] ?? ''),
  );

  const handleDragStart = (party: string) => (event: React.DragEvent) => {
    setSelectedParty(party);
    setDraggedParty(party);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', party);
  };

  const handleChipPointerDown = (party: string) => (event: React.PointerEvent) => {
    if (event.pointerType === 'mouse' || isTouchDevice) return;
    setTouchSelectionMode(true);
    setSelectedParty(party);
    setDraggedParty(null);
  };

  const handleChipTouchStart = (party: string) => (event: React.TouchEvent) => {
    touchPartyRef.current = party;
    setTouchSelectionMode(true);
    setSelectedParty(party);
    setDraggedParty(null);
    event.preventDefault();
  };

  const handleDragEnd = () => {
    setDraggedParty(null);
    setHoveredZone(null);
    setSelectedParty(null);
    setTouchSelectionMode(false);
  };

  const handleChipClick = (party: string) => {
    if (touchSelectionMode) return;
    setSelectedParty((current) => (current === party ? null : party));
  };

  const handleDrop = (targetBloc: string | null) => (event: React.DragEvent) => {
    event.preventDefault();
    const party = draggedParty || selectedParty || event.dataTransfer.getData('text/plain');
    if (!party) return;
    onPartyBlocChange(party, targetBloc);
    setDraggedParty(null);
    setSelectedParty(null);
    setHoveredZone(null);
    setTouchSelectionMode(false);
  };

  const assignPartyToBloc = (party: string, targetBloc: string | null) => {
    onPartyBlocChange(party, targetBloc);
    setDraggedParty(null);
    setSelectedParty(null);
    setHoveredZone(null);
    setTouchSelectionMode(false);
    touchPartyRef.current = null;
  };

  const handleTouchAssign = (targetBloc: string | null) => {
    const party = touchPartyRef.current || selectedParty;
    if (!touchSelectionMode || !party) return;
    assignPartyToBloc(party, targetBloc);
  };

  const allowDrop = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDragEnter = (targetBloc: string | null) => (event: React.DragEvent) => {
    event.preventDefault();
    setHoveredZone(targetBloc ?? '__unassigned__');
  };

  const handleDragLeave = (targetBloc: string | null) => (event: React.DragEvent) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    const zoneKey = targetBloc ?? '__unassigned__';
    if (hoveredZone === zoneKey) {
      setHoveredZone(null);
    }
  };

  const dropZoneProps = (targetBloc: string | null) => ({
    onDragEnter: handleDragEnter(targetBloc),
    onDragOver: allowDrop,
    onDragLeave: handleDragLeave(targetBloc),
    onDrop: handleDrop(targetBloc),
    onPointerUp: () => {
      handleTouchAssign(targetBloc);
    },
    onTouchEnd: () => {
      handleTouchAssign(targetBloc);
    },
    onMouseEnter: () => {
      if (!selectedParty) return;
      setHoveredZone(targetBloc ?? '__unassigned__');
    },
    onMouseLeave: () => {
      if (!selectedParty) return;
      setHoveredZone(null);
    },
    onClick: () => {
      if (!selectedParty) return;
      assignPartyToBloc(selectedParty, targetBloc);
    },
  });

  return (
    <div className="bloc-editor">
      <div className="bloc-editor-head">
        <span className="bloc-editor-title">שיוך מפלגות לגוש א / גוש ב</span>
      </div>
      <div className="bloc-editor-columns">
        <div
          className={`bloc-editor-column bloc-editor-column-a ${
            selectedParty !== null || hoveredZone === gushAKey
              ? 'is-drop-target'
              : ''
          }`}
          {...dropZoneProps(gushAKey)}
        >
          <div className="bloc-editor-column-title">
            {blocs.blocks[gushAKey].label}
          </div>
          <div className="bloc-editor-chips" {...dropZoneProps(gushAKey)}>
            {groupA.map((party) => (
              <button
                key={party.party}
                type="button"
                className={`bloc-chip ${selectedParty === party.party ? 'is-selected' : ''}`}
                draggable={!isTouchDevice}
                onDragStart={handleDragStart(party.party)}
                onDragEnd={handleDragEnd}
                onPointerDown={isTouchDevice ? undefined : handleChipPointerDown(party.party)}
                onTouchStart={isTouchDevice ? handleChipTouchStart(party.party) : undefined}
                onClick={() => {
                  if (isTouchDevice) {
                    setTouchSelectionMode(true);
                  }
                  handleChipClick(party.party);
                }}
                style={{ touchAction: isTouchDevice ? 'none' : 'manipulation' }}
                title="גרור לגוש אחר או ללא גוש"
              >
                {getPartyName(party.party)}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`bloc-editor-column bloc-editor-column-unassigned ${
            (hoveredZone === '__unassigned__' || (selectedParty && hoveredZone === '__unassigned__'))
              ? 'is-drop-target'
              : ''
          }`}
          {...dropZoneProps(null)}
        >
          <div className="bloc-editor-column-title">ללא גוש</div>
          <div className="bloc-editor-chips" {...dropZoneProps(null)}>
            {unassigned.map((party) => (
              <button
                key={party.party}
                type="button"
                className={`bloc-chip bloc-chip-unassigned ${selectedParty === party.party ? 'is-selected' : ''} ${draggedParty === party.party ? 'is-dragging' : ''}`}
                draggable={!isTouchDevice}
                onDragStart={handleDragStart(party.party)}
                onDragEnd={handleDragEnd}
                onPointerDown={isTouchDevice ? undefined : handleChipPointerDown(party.party)}
                onTouchStart={isTouchDevice ? handleChipTouchStart(party.party) : undefined}
                onClick={() => {
                  if (isTouchDevice) {
                    setTouchSelectionMode(true);
                  }
                  handleChipClick(party.party);
                }}
                style={{ touchAction: isTouchDevice ? 'none' : 'manipulation' }}
                title="גרור לגוש א' או גוש ב'"
              >
                <span className="bloc-editor-party" title={party.party}>
                  {getPartyName(party.party)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div
          className={`bloc-editor-column bloc-editor-column-b ${
            selectedParty !== null || hoveredZone === gushBKey
              ? 'is-drop-target'
              : ''
          }`}
          {...dropZoneProps(gushBKey)}
        >
          <div className="bloc-editor-column-title">
            {blocs.blocks[gushBKey].label}
          </div>
          <div className="bloc-editor-chips" {...dropZoneProps(gushBKey)}>
            {groupB.map((party) => (
              <button
                key={party.party}
                type="button"
                className={`bloc-chip ${selectedParty === party.party ? 'is-selected' : ''}`}
                draggable={!isTouchDevice}
                onDragStart={handleDragStart(party.party)}
                onDragEnd={handleDragEnd}
                onPointerDown={isTouchDevice ? undefined : handleChipPointerDown(party.party)}
                onTouchStart={isTouchDevice ? handleChipTouchStart(party.party) : undefined}
                onClick={() => {
                  if (isTouchDevice) {
                    setTouchSelectionMode(true);
                  }
                  handleChipClick(party.party);
                }}
                style={{ touchAction: isTouchDevice ? 'none' : 'manipulation' }}
                title="גרור לגוש אחר או ללא גוש"
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


interface BlocsDistributionPanelProps {
  editable: boolean;
  blocs: BlocsConfig;
  blocData: number[];
  blocColors: string[];
  blocLabels: string[];
  blocTotals: Record<string, number>;
  blocSeatDeltas: Record<string, number>;
  partyToBloc: Record<string, string | null | undefined>;
  onPartyBlocChange: (party: string, blocKey: string | null) => void;
  getPartyName: (party: string) => string;
  mandateParties: PartySummary[];
}

export const BlocsDistributionPanel: React.FC<BlocsDistributionPanelProps> = ({
  editable,
  blocs,
  blocData,
  blocColors,
  blocLabels,
  blocTotals,
  blocSeatDeltas,
  partyToBloc,
  onPartyBlocChange,
  getPartyName,
  mandateParties,
}) => (
  <div className="panel">
    <h2>חלוקת גושים</h2>
    <div className="blocs-display">
      <div className="donut-wrap">
        <Donut data={blocData} total={120} colors={blocColors} labels={blocLabels} />
      </div>
      <div className="bloc-legend-container">
        <BlocLegend blocs={blocs} totals={blocTotals} deltas={blocSeatDeltas} />
      </div>
    </div>
    {editable && (
      <BlocEditor
        blocs={blocs}
        partyToBloc={partyToBloc}
        parties={mandateParties}
        onPartyBlocChange={onPartyBlocChange}
        getPartyName={getPartyName}
      />
    )}
  </div>
);

