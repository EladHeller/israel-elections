import React from 'react';
import { numberFormat, percentageFormat } from '../lib/ui-helpers';

interface VoteDistributionSectionProps {
  nonParticipatingVotes: number;
  nonParticipatingPercent: number;
  participatingVotes: number;
  votesPerMandate: number;
  isEdited: boolean;
}

function aimPrismLight(event: React.PointerEvent<HTMLDivElement>) {
  if (event.pointerType !== 'mouse') return;
  const prism = event.currentTarget;
  const { left, top, width, height } = prism.getBoundingClientRect();
  const x = (event.clientX - left) / width;
  const y = (event.clientY - top) / height;
  prism.style.setProperty('--prism-light-x', `${x * 100}%`);
  prism.style.setProperty('--prism-light-y', `${y * 100}%`);
  prism.style.setProperty('--prism-yaw', `${(x - 0.5) * 9}deg`);
  prism.style.setProperty('--prism-pitch', `${(0.5 - y) * 11}deg`);
}

function resetPrismLight(event: React.PointerEvent<HTMLDivElement>) {
  const { style } = event.currentTarget;
  for (const property of ['--prism-light-x', '--prism-light-y', '--prism-yaw', '--prism-pitch']) {
    style.removeProperty(property);
  }
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
  const participatingShare = `${percentageFormat.format(participatingPercent)}%`;
  const nonParticipatingShare = `${percentageFormat.format(nonParticipatingPercent)}%`;

  return (
    <section className="panel election-summary-panel vote-distribution-panel" aria-labelledby="distribution-summary-title">
      <h2 id="distribution-summary-title">
        {isEdited ? 'חלוקת הקולות בתרחיש' : 'חלוקת הקולות הכשרים'}
      </h2>
      <dl className="vote-distribution-readouts">
        <div>
          <dt className="participating-label">משתתפים בחלוקת המנדטים</dt>
          <dd>
            <bdi className="summary-value">{numberFormat.format(participatingVotes)}</bdi>
            <bdi className="vote-distribution-share">{participatingShare}</bdi>
          </dd>
        </div>
        <div>
          <dt className="non-participating-label">מתחת לאחוז החסימה</dt>
          <dd>
            <bdi className="summary-value">{numberFormat.format(nonParticipatingVotes)}</bdi>
            <bdi className="vote-distribution-share">{nonParticipatingShare}</bdi>
          </dd>
        </div>
      </dl>
      <div
        className="vote-prism"
        role="img"
        aria-label={`${participatingShare} משתתפים בחלוקת המנדטים, ${nonParticipatingShare} מתחת לאחוז החסימה`}
        data-filled={totalVotes > 0}
        data-split={participatingPercent > 0 && nonParticipatingPercent > 0}
        style={{ '--participating-share': `${participatingPercent}%` } as React.CSSProperties}
        onPointerMove={aimPrismLight}
        onPointerLeave={resetPrismLight}
      >
        <div className="vote-prism-frame" aria-hidden="true">
          <div className="vote-prism-lens">
            <span className="vote-prism-participating" />
            <span className="vote-prism-divider" />
          </div>
          <div className="vote-prism-scale" />
        </div>
      </div>
      <dl className="summary-breakdown">
        {isEdited && (
          <div className="summary-detail">
            <dt>סה״כ קולות בתרחיש</dt>
            <dd><bdi>{numberFormat.format(totalVotes)}</bdi></dd>
          </div>
        )}
        <div className="summary-detail">
          <dt>קולות למנדט</dt>
          <dd><bdi>{numberFormat.format(votesPerMandate)}</bdi></dd>
        </div>
      </dl>
    </section>
  );
};

export default VoteDistributionSection;
