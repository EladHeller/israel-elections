import type { Answer, QuestionQuery } from './election-questions';
const count = (value: string | number) => typeof value === 'number' ? value.toLocaleString('he-IL') : value;

export function questionAnswerText(answer: Answer, kind: QuestionQuery['kind']): string[] {
  if (!answer.rows.length) return [];
  if (kind === 'insight' || kind === 'comparison' || kind === 'comparison-scenario') return answer.rows.map(row => String(row[0]));
  if (kind === 'scenario') {
    const changed = answer.rows.filter(row => Number(row[3]) !== 0);
    return changed.length ? changed.map(row => `${row[0]}: מ־${count(row[1])} ל־${count(row[2])} מנדטים.`)
      : ['חלוקת המנדטים נשארת ללא שינוי.'];
  }
  return answer.rows.map(row => {
    if (kind === 'seat-gap') return typeof row[1] === 'number'
      ? `${row[0]} הייתה צריכה עוד ${count(row[1])} קולות כדי להגדיל את מספר המנדטים שלה מעבר ל־${count(row[2])}.`
      : `${row[0]}: לא נמצאה תוספת שמגדילה את מספר המנדטים שלה בטווח החיפוש.`;
    if (kind === 'seat-loss') return typeof row[1] === 'number'
      ? `${row[0]} צריכה לאבד ${count(row[1])} קולות כדי לרדת ממספר המנדטים הנוכחי שלה (${count(row[2])}).`
      : `${row[0]}: אין הפחתת קולות שמקטינה את מספר המנדטים שלה בתוצאות שנבחרו.`;
    if (kind === 'gap') return Number(row[1]) === 0 ? `${row[0]} כבר מגיעה לאחוז החסימה.`
      : `${row[0]} צריכה עוד ${count(row[1])} קולות כדי להגיע לאחוז החסימה.`;
    if (kind === 'rank') return `${row[0]}: ${count(row[1])} קולות, שהם ${row[2]} מהקולות הכשרים במקום.`;
    if (kind === 'below-threshold-winners') return `${row[0]}: ${row[1]} קיבלה ${count(row[2])} קולות, שהם ${row[3]} מהקולות הכשרים במקום (${row[4]}).`;
    return `${row[0]} קיבלה ${count(row[1])} קולות, שהם ${row[2]} מהקולות הכשרים, ו־${count(row[3])} מנדטים.`;
  });
}
