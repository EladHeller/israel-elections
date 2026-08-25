import React from 'react';
import electionsConfigAll from '../data/elections-config.json';
import electionsValid from '../data/elections-valid.json';
import { numberFormat } from '../lib/ui-helpers';

const percentFormat = new Intl.NumberFormat('he-IL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatPercent = (value: number | null): string =>
  Number.isFinite(value) ? `${percentFormat.format(value as number)}%` : '—';

const formatNumber = (value: number | null): string =>
  Number.isFinite(value) ? numberFormat.format(value as number) : '—';

interface SummaryRow {
  id: number;
  turnoutPercentage: number | null;
  totalVotes: number | null;
  invalidVotes: number | null;
  validVotes: number | null;
  belowThresholdPercentage: number | null;
}

const rows: SummaryRow[] = Object.keys(electionsConfigAll as Record<string, any>)
  .map((id) => {
    const election = (electionsConfigAll as Record<string, any>)[id] || {};
    const totalVotes = Number(election.totalVotes);
    const electionVotes = (electionsValid as Record<string, any>)[id] || {};
    const validVotes = electionVotes.validVotes ?? null;
    const belowThresholdVotes = electionVotes.belowThresholdVotes ?? null;
    const invalidVotes =
      Number.isFinite(totalVotes) && Number.isFinite(validVotes)
        ? (totalVotes as number) - (validVotes as number)
        : null;
    const belowThresholdPercentage =
      Number.isFinite(belowThresholdVotes) && Number.isFinite(validVotes) && validVotes > 0
        ? ((belowThresholdVotes as number) / (validVotes as number)) * 100
        : null;
    return {
      id: Number(id),
      turnoutPercentage: Number(election.turnoutPercentage),
      totalVotes,
      invalidVotes,
      validVotes,
      belowThresholdPercentage,
    };
  })
  .sort((a, b) => b.id - a.id);

const AllElectionsSummary: React.FC = () => (
  <section className="panel all-elections-summary">
    <h2>סיכום נתוני בחירות לכל הכנסות</h2>
    <div className="summary-table-wrap">
      <table className="summary-table">
        <thead>
          <tr>
            <th>כנסת</th>
            <th>אחוז הצבעה</th>
            <th>סה&quot;כ מצביעים</th>
            <th>קולות פסולים</th>
            <th>קולות כשרים</th>
            <th>אחוז הקולות שלא עברו את אחוז החסימה</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.id}</td>
              <td>{formatPercent(row.turnoutPercentage)}</td>
              <td>{formatNumber(row.totalVotes)}</td>
              <td>{formatNumber(row.invalidVotes)}</td>
              <td>{formatNumber(row.validVotes)}</td>
              <td>{formatPercent(row.belowThresholdPercentage)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export default AllElectionsSummary;
