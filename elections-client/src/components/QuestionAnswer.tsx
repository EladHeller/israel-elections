import React from 'react';
import type { Answer, QuestionQuery } from '../lib/election-questions';

const count = (value: string | number) => typeof value === 'number' ? value.toLocaleString('he-IL') : value;
export default function QuestionAnswer({ answer, kind }: { answer: Answer; kind: QuestionQuery['kind'] }) {
  if (!answer.rows.length) return <p>לא נמצאו תוצאות מתאימות בנתונים הזמינים.</p>;
  if (kind === 'seat-loss') return <>{answer.rows.map((row, index) => <p key={index}>
    <strong>{row[0]}</strong>{typeof row[1] === 'number'
      ? <> צריכה לאבד <strong>{count(row[1])} קולות</strong> כדי לרדת ממספר המנדטים הנוכחי שלה ({count(row[2])}). הירידה יכולה להיות של יותר ממנדט אחד אם היא יורדת מתחת לאחוז החסימה.</>
      : <>: אין הפחתת קולות שמקטינה את מספר המנדטים שלה בתוצאות שנבחרו.</>}
  </p>)}</>;
  if (kind === 'seat-gap') return <>{answer.rows.map((row, index) => <p key={index}>
    <strong>{row[0]}</strong>{typeof row[1] === 'number'
      ? <> הייתה צריכה עוד <strong>{count(row[1])} קולות</strong> כדי להגדיל את מספר המנדטים שלה מעבר ל־{count(row[2])}.</>
      : <>: לא נמצאה תוספת שמגדילה את מספר המנדטים שלה בטווח החיפוש.</>}
  </p>)}</>;
  if (kind === 'scenario') {
    const changed = answer.rows.filter(row => Number(row[3]) !== 0);
    if (!changed.length) return <p>חלוקת המנדטים נשארת ללא שינוי.</p>;
    return <>{changed.map(row => {
      const delta = Number(row[3]);
      const amount = Math.abs(delta) === 1 ? 'מנדט אחד' : `${count(Math.abs(delta))} מנדטים`;
      return <p key={String(row[0])} className={`question-seat-change ${delta > 0 ? 'is-gain' : 'is-loss'}`}>
        <strong>{row[0]}</strong> {delta > 0 ? 'מקבלת' : 'מאבדת'} {amount}, {delta > 0 ? 'ועולה' : 'ויורדת'} מ־{count(row[1])} ל־{count(row[2])} מנדטים.
      </p>;
    })}<p className="question-answer-note">יתר הרשימות נשארות ללא שינוי.</p></>;
  }
  return <>{answer.rows.map((row, index) => <p key={index}>
    <strong>{row[0]}</strong>{kind === 'rank' ? <>: {count(row[1])} קולות, שהם {row[2]} מהקולות הכשרים במקום.</>
      : kind === 'gap' ? Number(row[1]) === 0 ? ' כבר מגיעה לאחוז החסימה.' : <> צריכה עוד <strong>{count(row[1])} קולות</strong> כדי להגיע לאחוז החסימה.</>
        : <> קיבלה <strong>{count(row[1])} קולות</strong>, שהם {row[2]} מהקולות הכשרים, ו־<strong>{count(row[3])} מנדטים</strong>.</>}
  </p>)}</>;
}
