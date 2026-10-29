import React from 'react';
import type { RemainingSeatRace } from '../lib/remaining-votes';
import { numberFormat } from '../lib/ui-helpers';

const percent = (share: number) => `${(share * 100).toLocaleString('he-IL', { maximumFractionDigits: 2 })}%`;

export default function RemainingVotesPanel({ races, remainingVotes, getPartyName }: {
  races: RemainingSeatRace[];
  remainingVotes: number;
  getPartyName: (party: string) => string;
}) {
  return (
    <section className="panel remaining-votes-panel" aria-label="מנדט נוסף מהקולות שנותרו">
      <h2>מנדט נוסף מהקולות שנותרו</h2>
      <p className="close-races-subtitle">אומדן הקולות הכשרים שנותרו: <bdi>{numberFormat.format(remainingVotes)}</bdi></p>
      <table className="close-seat-table remaining-votes-table">
        <thead><tr><th scope="col">רשימה</th><th scope="col">אחוז עד כה</th>
          <th scope="col">אחוז נדרש מהנותרים</th><th scope="col">קולות נדרשים מהנותרים</th></tr></thead>
        <tbody>{races.map(race => (
          <tr key={race.party}>
            <th scope="row">{getPartyName(race.party)}</th>
            <td><bdi>{percent(race.currentShare)}</bdi></td>
            <td>{race.requiredShare === null ? '—' : <bdi>{percent(race.requiredShare)}</bdi>}</td>
            <td>{race.requiredVotes === null ? <span className="remaining-votes-impossible">אין די קולות שנותרו</span>
              : <bdi>{numberFormat.format(race.requiredVotes)}</bdi>}</td>
          </tr>
        ))}</tbody>
      </table>
      <p className="close-races-subtitle">החישוב לכל רשימה מניח שהיחס בין שאר הרשימות נשמר.</p>
      <p className="close-races-subtitle">האומדן מניח ששיעור הקולות הכשרים נשמר.</p>
    </section>
  );
}
