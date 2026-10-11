import React from 'react';

interface PartyRowProps {
  name: string;
  ballotLetter?: string;
  seats: React.ReactNode;
  votes: React.ReactNode;
  bar?: { width: number; color: string };
}

const PartyRow: React.FC<PartyRowProps> = ({ name, ballotLetter, seats, votes, bar }) => (
  <div className="party-row">
    <div className="party-meta" title={name}>
      {ballotLetter && (
        <span className="party-ballot-letter" aria-label={`אותיות בקלפי: ${ballotLetter}`}>
          {ballotLetter}
        </span>
      )}
      <span className="party-name">{name}</span>
      <span className="party-seats">{seats}</span>
    </div>
    <div className={`party-bar${bar ? '' : ' party-bar-empty'}`} aria-hidden="true">
      {bar && (
        <div
          className="party-bar-fill"
          style={{ width: `${bar.width}%`, background: bar.color }}
        />
      )}
    </div>
    <div className="party-votes">
      {votes}
      <span>קולות</span>
    </div>
  </div>
);

export default PartyRow;
