import React from 'react';
import { getCountingProgress } from '../lib/counting-progress';
import { numberFormat } from '../lib/ui-helpers';
import type { ElectionResultsPayload } from '../types';

export default function CountingProgress({ results, totalVotes, isDemo }: {
  results: ElectionResultsPayload; totalVotes?: number; isDemo: boolean;
}) {
  const progress = getCountingProgress(results, totalVotes);
  const { percentage, isEarly, estimateExceeded, includesInvalid, countedVotes } = progress;
  // Round down so a partial count cannot look complete, or cross the early-count boundary.
  const percentageLabel = percentage !== null && percentage > 0 && percentage < 0.1
    ? 'פחות מ־0.1%'
    : percentage === null ? '—' : `כ־${(Math.floor(percentage * 10) / 10).toLocaleString('he-IL', { maximumFractionDigits: 1 })}%`;
  return <section className={`counting-progress${isEarly ? ' counting-progress-early' : ''}`} aria-label={isDemo ? 'התקדמות הספירה בדמו' : 'התקדמות ספירת הקולות'}>
    <div className="counting-progress-heading">
      <div><span>{isDemo ? 'התקדמות הספירה · נתוני דמה' : 'התקדמות הספירה'}</span>
        <h2>{percentage === null ? 'הספירה בעיצומה' : <><bdi>{percentageLabel}</bdi> מהקולות נספרו</>}</h2>
      </div>
      <p><bdi>{numberFormat.format(countedVotes)}</bdi> קולות {includesInvalid ? 'נספרו' : 'כשרים נספרו'}
        {percentage !== null && <> מתוך כ־<bdi>{numberFormat.format(totalVotes!)}</bdi> מצביעים</>}
      </p>
    </div>
    {percentage !== null && <progress max="100" value={percentage} aria-label="אחוז הקולות שנספרו" />}
    <p className="counting-progress-note">
      {estimateExceeded ? 'מספר הקולות שנספרו גבוה מאומדן המצביעים. אחוז הספירה אינו זמין עד לעדכון האומדן.'
        : percentage === null ? 'אחוז הספירה יוצג כשיהיה זמין אומדן של מספר המצביעים.'
        : 'אחוז הספירה מבוסס על אומדן מספר המצביעים.'}
      {!includesInvalid && ' קולות פסולים אינם כלולים בנתון הספירה הזמין.'}
    </p>
    <p className={isEarly ? 'counting-progress-warning' : 'counting-progress-note'}>
      {isEarly ? 'הספירה בראשיתה. התוצאות החלקיות עלולות להיות שונות מאוד מהתוצאות הסופיות.'
        : 'התוצאות חלקיות. הקלפיות שנספרו אינן בהכרח מייצגות את כלל המצביעים.'}
    </p>
  </section>;
}
