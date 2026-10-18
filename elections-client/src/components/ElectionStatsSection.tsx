import React from 'react';
import { numberFormat } from '../lib/ui-helpers';

interface ElectionStatsSectionProps {
  turnoutPercentage?: number;
  totalVotes?: number;
  invalidVotes?: number;
  countedVotes?: number;
  isCounting?: boolean;
  validVotes: number;
  isSimulator: boolean;
  isDemo?: boolean;
}

const ElectionStatsSection: React.FC<ElectionStatsSectionProps> = ({
  turnoutPercentage,
  totalVotes,
  invalidVotes,
  countedVotes,
  isCounting,
  validVotes,
  isSimulator,
  isDemo,
}) => {
  const invalidVotePercent =
    invalidVotes != null && (isCounting ? countedVotes : totalVotes)
      ? (invalidVotes / (isCounting ? countedVotes! : totalVotes!)) * 100
      : null;

  return (
    <section className="panel election-summary-panel" aria-labelledby="voting-summary-title">
      <h2 id="voting-summary-title">{isDemo ? 'הצבעה בדמו' : isSimulator ? 'הצבעה בפועל' : 'הצבעה'}</h2>
      <div className="summary-headline">
        <span className="summary-value">
          {turnoutPercentage != null ? `${Number(turnoutPercentage).toFixed(2)}%` : '—'}
        </span>
        <span>אחוז הצבעה</span>
      </div>
      <div className="summary-caption">
        <bdi>{totalVotes != null ? numberFormat.format(totalVotes) : '—'}</bdi> {isCounting ? 'מצביעים לפי האומדן' : 'מצביעים'}
      </div>
      <dl className="summary-breakdown">
        <div className="summary-detail">
          <dt>{isCounting ? 'קולות כשרים שנספרו' : 'קולות כשרים'}</dt>
          <dd><bdi>{numberFormat.format(validVotes)}</bdi></dd>
        </div>
        <div className="summary-detail">
          <dt>{isCounting ? 'קולות פסולים שנספרו' : 'קולות פסולים'}</dt>
          <dd>
            <bdi>{invalidVotes != null ? numberFormat.format(invalidVotes) : '—'}</bdi>
            {invalidVotePercent != null && (
              <span className="summary-caption"> ({invalidVotePercent.toFixed(2)}%)</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
};

export default ElectionStatsSection;

