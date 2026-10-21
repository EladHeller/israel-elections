import React from 'react';
import BlocEditor from './BlocEditor';
import UnassignedParties from './UnassignedParties';
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
    <UnassignedParties parties={mandateParties.filter(({ party }) => !partyToBloc[party])}
      getPartyName={getPartyName} />
    {editable && (
      <BlocEditor
        blocs={blocs}
        partyToBloc={partyToBloc}
        parties={mandateParties.map(({ party }) => party)}
        onPartyBlocChange={onPartyBlocChange}
        getPartyName={getPartyName}
      />
    )}
  </div>
);

