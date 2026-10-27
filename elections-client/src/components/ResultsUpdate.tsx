import React from 'react';
import type { ElectionResultsPayload } from '../types';
import { getResultChanges } from '../lib/live-results';
import { getCountingProgress } from '../lib/counting-progress';

interface Props {
  isDemo?: boolean;
  previous: ElectionResultsPayload | null;
  current: ElectionResultsPayload;
  blockPercentage: number;
  getPartyName: (party: string) => string;
}

export default function ResultsUpdate({ isDemo, previous, current, blockPercentage, getPartyName }: Props) {
  const awaitingResults = getCountingProgress(current).countedVotes === 0;
  const changes = previous ? getResultChanges(previous, current, blockPercentage) : [];
  const describe = (change: typeof changes[number]) => {
    const name = getPartyName(change.party);
    if (change.threshold === 'entered') return `${name} עברה את אחוז החסימה`;
    if (change.threshold === 'left') return `${name} ירדה מתחת לאחוז החסימה`;
    return `${name} ${change.delta > 0 ? 'עלתה' : 'ירדה'} ל־${change.seats} מנדטים`;
  };
  return (
    <section className="panel results-update" aria-label="העדכון האחרון">
      <div className="update-label">{!isDemo && <span className="live-dot" />}{isDemo ? 'עדכון לדוגמה · מידע דמה' : awaitingResults ? 'ממתינים לתוצאות' : 'בספירה'}
      </div>
      <div role="status" aria-live="polite" aria-atomic="true">
        {awaitingResults ? <span>עדיין לא התקבלו תוצאות אמת. התוצאות יתעדכנו אוטומטית.</span> : previous ? <>
          <strong>{isDemo ? 'בדוגמה הזו' : 'בעדכון האחרון'}</strong>
          <span>{changes.length ? changes.slice(0, 2).map(describe).join(' · ') : 'ללא שינוי בחלוקת המנדטים'}</span>
          {changes.length > 2 && <details><summary>{changes.length === 3 ? 'שינוי נוסף' : `עוד ${changes.length - 2} שינויים`}</summary>
            <ul>{changes.slice(2).map((change) => <li key={change.party}>{describe(change)}</li>)}</ul>
          </details>}
        </> : <span>התוצאות מתעדכנות אוטומטית</span>}
      </div>
    </section>
  );
}
