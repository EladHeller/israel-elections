import React from 'react';
import { numberFormat } from '../lib/ui-helpers';

interface VoteDistributionSectionProps {
  nonParticipatingVotes: number;
  nonParticipatingPercent: number;
  participatingVotes: number;
  votesPerMandate: number;
  isEdited: boolean;
}

const VoteDistributionSection: React.FC<VoteDistributionSectionProps> = ({
  nonParticipatingVotes,
  nonParticipatingPercent,
  participatingVotes,
  votesPerMandate,
  isEdited,
}) => {
  const totalVotes = participatingVotes + nonParticipatingVotes;
  const participatingPercent = totalVotes > 0 ? 100 - nonParticipatingPercent : 0;

  return (
    <section className="panel election-summary-panel" aria-labelledby="distribution-summary-title">
      <h2 id="distribution-summary-title">
        {isEdited ? 'חלוקת הקולות בתרחיש' : 'חלוקת הקולות הכשרים'}
      </h2>
      <div className="summary-headline">
        <bdi className="summary-value">{numberFormat.format(participatingVotes)}</bdi>
      </div>
      <div className="summary-caption">משתתפים בחלוקת המנדטים</div>
      <div
        className="vote-distribution-bar"
        role="img"
        aria-label={`${participatingPercent.toFixed(2)}% משתתפים בחלוקת המנדטים, ${nonParticipatingPercent.toFixed(2)}% מתחת לאחוז החסימה`}
      >
        <span className="participating-votes-fill" style={{ width: `${participatingPercent}%` }} />
        <span className="non-participating-votes-fill" style={{ width: `${nonParticipatingPercent}%` }} />
      </div>
      <dl className="distribution-details">
        <div className="summary-detail">
          <dt className="non-participating-label">מתחת לאחוז החסימה</dt>
          <dd>
            <bdi>{numberFormat.format(nonParticipatingVotes)}</bdi>
            <span className="summary-caption"> ({nonParticipatingPercent.toFixed(2)}%)</span>
          </dd>
        </div>
        {isEdited && (
          <div className="summary-detail">
            <dt>סה״כ קולות בתרחיש</dt>
            <dd><bdi>{numberFormat.format(totalVotes)}</bdi></dd>
          </div>
        )}
        <div className="summary-detail summary-breakdown">
          <dt>קולות למנדט</dt>
          <dd><bdi>{numberFormat.format(votesPerMandate)}</bdi></dd>
        </div>
      </dl>
    </section>
  );
};

export default VoteDistributionSection;
