import React from 'react';
import { numberFormat } from '../lib/ui-helpers';

interface SecondarySummarySectionProps {
  nonParticipatingVotes: number;
  nonParticipatingPercent: number;
  participatingVotes: number;
  votesPerMandate: number;
}

const SecondarySummarySection: React.FC<SecondarySummarySectionProps> = ({
  nonParticipatingVotes,
  nonParticipatingPercent,
  participatingVotes,
  votesPerMandate,
}) => (
  <section className="summary summary-extra">
    <div className="card">
      <div className="card-label">סה\"כ קולות שלא משתתפים בחלוקה</div>
      <div className="card-value">
        {numberFormat.format(nonParticipatingVotes)} (
        {nonParticipatingPercent.toFixed(2)}%)
      </div>
    </div>
    <div className="card">
      <div className="card-label">סה\"כ קולות משתתפים בחלוקה</div>
      <div className="card-value">{numberFormat.format(participatingVotes)}</div>
    </div>
    <div className="card">
      <div className="card-label">מספר הקולות למנדט</div>
      <div className="card-value">{numberFormat.format(votesPerMandate)}</div>
    </div>
  </section>
);

export default SecondarySummarySection;

