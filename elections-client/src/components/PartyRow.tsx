import React from 'react';

interface PartyRowProps {
  name: string;
  electionNight?: boolean;
  ballotLetter?: string;
  percentage?: string;
  seats: React.ReactNode;
  votes: React.ReactNode;
  bar?: { width: number; color: string };
}

const PartyRow: React.FC<PartyRowProps> = ({ name, electionNight = false, ballotLetter, percentage, seats, votes, bar }) => (
  <div className="party-row">
    <div className="party-meta" title={name}>
      {ballotLetter && (
        <span className="party-ballot-letter" aria-label={`אותיות בקלפי: ${ballotLetter}`}>
          {ballotLetter}
        </span>
      )}
      <span className="party-name">{name}</span>
      {!electionNight && <span className="party-seats">{seats}</span>}
    </div>
    {electionNight && <span className="party-seats">{seats}</span>}
    <div className={`party-bar${bar ? '' : ' party-bar-empty'}`} aria-hidden="true">
      {bar && (
        <div
          className="party-bar-fill"
          style={{ width: `${bar.width}%`, '--chart-color': bar.color } as React.CSSProperties}
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
