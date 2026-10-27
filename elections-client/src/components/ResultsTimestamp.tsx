import React from 'react';

const timestampFormat = new Intl.DateTimeFormat('he-IL', {
  timeZone: 'Asia/Jerusalem',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export default function ResultsTimestamp({ time }: { time?: string }) {
  if (!time || !Number.isFinite(Date.parse(time))) return null;
  return <span className="results-timestamp">
    עדכון התוצאות האחרון: <time dateTime={time}><bdi>{timestampFormat.format(new Date(time))}</bdi></time> (שעון ישראל)
  </span>;
}
