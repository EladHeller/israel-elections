import React from 'react';
import electionsConfigAll from '../data/elections-config.json';
import electionsValid from '../data/elections-valid.json';
import { numberFormat } from '../lib/ui-helpers.js';

const percentFormat = new Intl.NumberFormat('he-IL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatPercent = (value) => (Number.isFinite(value) ? `${percentFormat.format(value)}%` : '—');

const formatNumber = (value) => (Number.isFinite(value) ? numberFormat.format(value) : '—');

const rows = Object.keys(electionsConfigAll)
  .map((id) => {
    const election = electionsConfigAll[id] || {};
    const totalVotes = Number(election.totalVotes);
    const validVotes = electionsValid[id]?.validVotes ?? null;
    const invalidVotes = Number.isFinite(totalVotes) && Number.isFinite(validVotes)
      ? totalVotes - validVotes
      : null;
    return {
      id: Number(id),
      turnoutPercentage: Number(election.turnoutPercentage),
      totalVotes,
      invalidVotes,
      validVotes,
    };
  })
  .sort((a, b) => b.id - a.id);

const AllElectionsSummary = () => (
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export default AllElectionsSummary;
