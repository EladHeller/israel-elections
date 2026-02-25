import React from 'react';
import { numberFormat } from '../lib/ui-helpers';

interface ElectionStatsSectionProps {
  turnoutPercentage?: number;
  totalVotes?: number;
  invalidVotes?: number;
}

const ElectionStatsSection: React.FC<ElectionStatsSectionProps> = ({
  turnoutPercentage,
  totalVotes,
  invalidVotes,
}) => {
  const invalidVotePercent =
    invalidVotes != null && totalVotes
      ? (invalidVotes / totalVotes) * 100
      : null;

  return (
    <section className="summary stats-summary">
      <div className="card">
        <div className="card-label">אחוז הצבעה</div>
        <div className="card-value">
          {turnoutPercentage != null ? Number(turnoutPercentage).toFixed(2) : '—'}%
        </div>
      </div>
      <div className="card">
        <div className="card-label">סה"כ קולות</div>
        <div className="card-value">
          {totalVotes != null ? numberFormat.format(totalVotes) : '—'}
        </div>
      </div>
      <div className="card">
        <div className="card-label">קולות פסולים</div>
        <div className="card-value">
          {invalidVotes != null ? numberFormat.format(invalidVotes) : '—'}
        </div>
        {invalidVotePercent != null && (
          <div className="card-sub">({invalidVotePercent.toFixed(2)}%)</div>
        )}
      </div>
    </section>
  );
};

export default ElectionStatsSection;

