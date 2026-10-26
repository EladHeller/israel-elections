import React from 'react';

interface Props {
  parties: { party: string; mandats: number }[];
  getPartyName: (party: string) => string;
  hasResults?: boolean;
}

export default function UnassignedParties({ parties, getPartyName, hasResults = true }: Props) {
  if (!hasResults || !parties.length) return null;
  const seats = parties.reduce((sum, party) => sum + party.mandats, 0);
  return <div className="unassigned-summary">
    <div className="unassigned-heading">
      <strong>רשימות ללא שיוך לגוש</strong>
      <span className="unassigned-seats"><strong>{seats}</strong> מנדטים</span>
    </div>
    <ul className="unassigned-parties" aria-label="רשימות ללא שיוך לגוש">
      {parties.map(({ party, mandats }) => <li key={party}>
        <span>{getPartyName(party)}</span>
        <strong>{mandats} מנדטים</strong>
      </li>)}
    </ul>
  </div>;
}
