import React, { useState } from 'react';
import { sortSummaryRows, type SummaryRow, type SummarySortKey } from '../lib/all-elections-sort';
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
      thresholdPercentage: Number(election.blockPercentage) * 100
    };
  })
  .sort((a, b) => b.id - a.id);

const columns: { key: SummarySortKey; label: string }[] = [
  { key: 'id', label: 'כנסת' },
  { key: 'turnoutPercentage', label: 'אחוז הצבעה' },
  { key: 'totalVotes', label: 'סה״כ מצביעים' },
  { key: 'invalidVotes', label: 'קולות פסולים' },
  { key: 'validVotes', label: 'קולות כשרים' },
  { key: 'thresholdPercentage', label: 'אחוז החסימה' },
  { key: 'belowThresholdPercentage', label: 'לא עברו את אחוז החסימה' },
];

const AllElectionsSummary: React.FC = () => {
  const [sort, setSort] = useState<{ key: SummarySortKey; direction: 'asc' | 'desc' }>({ key: 'id', direction: 'desc' });
  const sortedRows = sortSummaryRows(rows, sort.key, sort.direction);
  return (
    <section className="panel all-elections-summary">
      <h2>סיכום נתוני בחירות לכל הכנסות</h2>
      <div className="summary-table-wrap">
        <table className="summary-table">
          <thead>
            <tr>
              {columns.map(({ key, label }) => (
                <th key={key} scope="col" aria-sort={sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <button type="button" className="summary-sort-button"
                    onClick={() => setSort(previous => ({ key, direction: previous.key === key && previous.direction === 'desc' ? 'asc' : 'desc' }))}
                    aria-label={`${label}: מיון ${sort.key === key && sort.direction === 'desc' ? 'בסדר עולה' : 'בסדר יורד'}`}>
                    {label} <span aria-hidden="true">{sort.key === key ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{formatPercent(row.turnoutPercentage)}</td>
                <td>{formatNumber(row.totalVotes)}</td>
                <td>{formatNumber(row.invalidVotes)}</td>
                <td>{formatNumber(row.validVotes)}</td>
                <td>{formatPercent(row.thresholdPercentage)}</td>
                <td>{formatPercent(row.belowThresholdPercentage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default AllElectionsSummary;
