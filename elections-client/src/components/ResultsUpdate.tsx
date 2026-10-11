import React from 'react';
import type { ElectionResultsPayload } from '../types';
import { getResultChanges } from '../lib/live-results';
import { formatTime } from '../lib/ui-helpers';

interface Props {
  previous: ElectionResultsPayload | null;
  current: ElectionResultsPayload;
  blockPercentage: number;
  getPartyName: (party: string) => string;
}

export default function ResultsUpdate({ previous, current, blockPercentage, getPartyName }: Props) {
  const changes = previous ? getResultChanges(previous, current, blockPercentage) : [];
  const describe = (change: typeof changes[number]) => {
    const name = getPartyName(change.party);
    if (change.threshold === 'entered') return `${name} עברה את אחוז החסימה`;
    if (change.threshold === 'left') return `${name} ירדה מתחת לאחוז החסימה`;
    return `${name} ${change.delta > 0 ? 'עלתה' : 'ירדה'} ל־${change.seats} מנדטים`;
  };
  return (
    <section className="results-update" aria-label="העדכון האחרון">
      <div className="update-label"><span className="live-dot" />בספירה
        {current.time && <time dateTime={current.time}>נתונים מ־{formatTime(current.time)}</time>}
      </div>
      <div role="status" aria-live="polite" aria-atomic="true">
        {previous ? <>
          <strong>בעדכון האחרון</strong>
          <span>{changes.length ? changes.slice(0, 2).map(describe).join(' · ') : 'ללא שינוי בחלוקת המנדטים'}</span>
          {changes.length > 2 && <details><summary>{changes.length === 3 ? 'שינוי נוסף' : `עוד ${changes.length - 2} שינויים`}</summary>
            <ul>{changes.slice(2).map((change) => <li key={change.party}>{describe(change)}</li>)}</ul>
          </details>}
        </> : <span>התוצאות מתעדכנות אוטומטית</span>}
      </div>
    </section>
  );
}
