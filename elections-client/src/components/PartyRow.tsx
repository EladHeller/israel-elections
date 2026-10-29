import React from 'react';
import { Link } from 'react-router-dom';

interface PartyRowProps {
  name: string;
  researchHref?: string;
  electionNight?: boolean;
  ballotLetter?: string;
  percentage?: string;
  seats: React.ReactNode;
  votes: React.ReactNode;
  bar?: { width: number; color: string };
}

const PartyRow: React.FC<PartyRowProps> = ({ researchHref, name, electionNight = false, ballotLetter, percentage, seats, votes, bar }) => (
  <div className="party-row" style={bar ? { '--party-share': `${bar.width}%` } as React.CSSProperties : undefined}>
    <div className="party-meta" title={name}>
      {ballotLetter && (
        <span className="party-ballot-letter" aria-label={`אותיות בקלפי: ${ballotLetter}`}>
          {ballotLetter}
        </span>
      )}
      <span className="party-name">{researchHref ? <Link className="party-research-link" to={researchHref} title={`מחקר יישובים: ${name}`}>{name}</Link> : name}</span>
      {!electionNight && <span className="party-seats">{seats}</span>}
    </div>
    {electionNight && <span className="party-seats">{seats}</span>}
    <div className={`party-bar${bar ? '' : ' party-bar-empty'}`} aria-hidden="true">
      {bar && (
        <div
          className="party-bar-fill"
          style={{ '--chart-color': bar.color } as React.CSSProperties}
        />
      )}
    </div>
    <div className="party-votes">
      {electionNight ? (
        <>
          {percentage && <span className="party-percentage" dir="ltr">{percentage}</span>}
          <span className="party-vote-total">{votes} <span>קולות</span></span>
        </>
      ) : <>{votes}<span>קולות</span></>}
    </div>
  </div>
);

export default PartyRow;
