import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ElectionSelector from './ElectionSelector';
import ThemeToggle from './ThemeToggle';
import ResultsTimestamp from './ResultsTimestamp';
import { useElectionData } from '../hooks/use-election-data';
import { hasLocalityData, pollingStationSource } from '../lib/locality-availability';
import { parseLocalities, parsePollingStations } from '../lib/party-research';
import { executeElectionQuestion, parseElectionQuestion, type Answer, type QuestionContext, type QuestionParse, type QuestionQuery } from '../lib/election-questions';

const examples = ['באיזה יישוב הליכוד קיבלה הכי הרבה קולות?', 'באילו קלפיות הליכוד קיבלה האחוז הגבוה ביותר?',
  'כמה קולות היו חסרים לעמך ישראל לעבור את אחוז החסימה?', 'מה היה קורה אם לא היה אחוז חסימה?',
  'מה היה קורה אם הציונות הדתית הייתה מקבלת את הקולות של עמך ישראל?',
  'מה היה קורה אם אחוז החסימה היה 2% וגם בלי הסכמי עודפים?'];

type Prepared = { parsed: QuestionParse; context: QuestionContext; time?: string };
export default function ElectionQuestions() {
  const { electionId = '' } = useParams();
  return <QuestionScreen key={electionId} electionId={electionId} />;
}
function QuestionScreen({ electionId }: { electionId: string }) {
  const navigate = useNavigate();
  const data = useElectionData(electionId, !!electionId);
  const [question, setQuestion] = useState('');
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const changeQuestion = (value: string) => { setQuestion(value); setPrepared(null); setAnswer(null); setError(null); };
  const analyze = (event: React.FormEvent) => {
    event.preventDefault();
    if (!data.results) return;
    const names = { ...data.partyNames };
    for (const list of data.electionManifest!.lists) names[list.ballotLetter] ??= list.name;
    const context = { votes: data.results.voteData, names, config: data.electionConfig };
    setPrepared({ parsed: parseElectionQuestion(question, context), context, time: data.results.time });
    setAnswer(null); setError(null);
  };
  const calculate = async (query: QuestionQuery, context: QuestionContext) => {
    const controller = new AbortController();
    active.current?.abort(); active.current = controller;
    setBusy(true); setError(null);
    try {
      let places;
      if (query.kind === 'rank') {
        const source = query.level === 'stations' ? pollingStationSource(electionId) : hasLocalityData(electionId) ? `/data/${electionId}/elections.csv` : null;
        if (!source) throw new Error('אין נתוני מקומות לבחירות אלו. אפשר לשאול על התוצאות הארציות או לנסות מערכת בחירות אחרת.');
        const response = await fetch(source, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('לא ניתן לטעון את קובץ המקומות. ייתכן שאינו זמין לבחירות אלו; אפשר לנסות שוב.');
        places = (query.level === 'stations' ? parsePollingStations : parseLocalities)(await response.text());
      }
      if (!controller.signal.aborted) setAnswer(executeElectionQuestion(query, context, places));
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'החישוב נכשל. אפשר לנסות שוב.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const validElection = !!electionId && data.availableElections.includes(electionId);
  return <main className="screen election-questions" dir="rtl">
    <header className="header"><Link to={validElection ? `/results/${electionId}` : '/'}>← לתוצאות הבחירות</Link><ThemeToggle /></header>
    <section className="panel">
      <p className="subtitle">מעבדת שאלות · גרסת ניסיון</p>
      <h1>מה תרצו לדעת על הבחירות?</h1>
      <p>בחרו מערכת בחירות ושאלו על התוצאות, היישובים והקלפיות, או בדקו מה היה קורה בתרחיש אחר.</p>
      <ElectionSelector value={validElection ? electionId : null} elections={data.availableElections} onChange={id => navigate(`/questions/${id}`)} />
      {electionId && data.availableElections.length > 0 && !validElection && <p role="alert">מערכת הבחירות אינה קיימת. בחרו מערכת מהרשימה.</p>}
      {data.error && <p role="alert">טעינת נתוני הבחירות נכשלה. אפשר לבחור שוב או לרענן את העמוד.</p>}
      {data.refreshError && <p role="status">{data.refreshError}</p>}
      {validElection && !data.results && !data.error && <p role="status">{data.electionManifest && !['counting', 'final'].includes(data.electionManifest.phase) ? 'אין עדיין תוצאות לבחירות אלו.' : 'טוען תוצאות…'}</p>}
      {data.electionManifest?.phase === 'counting' && <p className="research-notice">הספירה נמשכת. התשובה מחושבת לפי תמונת הנתונים בזמן פענוח השאלה; לחישוב מעודכן פענחו אותה שוב.</p>}
      <form onSubmit={analyze}>
        <label htmlFor="election-question">השאלה שלכם</label>
        <textarea id="election-question" rows={3} maxLength={600} value={question} disabled={!data.results || busy} onChange={event => changeQuestion(event.target.value)} placeholder="למשל: מה היה קורה אם לא היה אחוז חסימה?" />
        <button type="submit" className="primary" disabled={!validElection || !data.results || !question.trim() || busy}>פענוח השאלה</button>
      </form>
      <details><summary>דוגמאות שאפשר לנסות</summary><p>שמות הרשימות צריכים להתאים לבחירות שנבחרו. אפשר להשתמש גם באותיות הקלפי.</p>
        <div className="question-examples">{examples.map(example => <button type="button" className="ghost" key={example} disabled={busy} onClick={() => changeQuestion(example)}>{example}</button>)}</div>
      </details>
      <p className="subtitle">הגרסה תומכת בניסוחים מוגדרים ואינה מבינה כל שאלה. כל הפענוח והחישוב נעשים במכשיר שלכם.</p>
    </section>
    {prepared && <section className="panel" aria-live="polite">
      {'error' in prepared.parsed ? <p role="alert">{prepared.parsed.error}</p> : <>
        <h2>כך הבנתי את השאלה</h2><p>{prepared.parsed.explanation}</p>
        {data.electionManifest?.phase === 'counting' && prepared.time && <p>תמונת התוצאות הארציות: <ResultsTimestamp time={prepared.time} /></p>}
        <details><summary>הצגת השאילתה המובנית</summary><pre dir="ltr">{JSON.stringify(prepared.parsed.query, null, 2)}</pre></details>
        <button type="button" className="primary" disabled={busy} onClick={calculate.bind(null, prepared.parsed.query, prepared.context)}>{busy ? 'מחשב…' : 'חישוב התשובה'}</button>
      </>}
      {error && <p role="alert">{error}</p>}
    </section>}
    {answer && <section className="panel" aria-live="polite"><h2>התשובה</h2><p>{answer.note}</p>
      {!answer.rows.length ? <p>לא נמצאו תוצאות מתאימות בקובץ הזמין.</p> : <div className="question-table"><table><thead><tr>{answer.columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead>
        <tbody>{answer.rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{typeof cell === 'number' ? cell.toLocaleString('he-IL') : cell}</td>)}</tr>)}</tbody></table></div>}
    </section>}
  </main>;
}
