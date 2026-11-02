import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ElectionSelector from './ElectionSelector';
import ThemeToggle from './ThemeToggle';
import ResultsTimestamp from './ResultsTimestamp';
import QuestionAnswer from './QuestionAnswer';
import { useElectionData } from '../hooks/use-election-data';
import { hasLocalityData, pollingStationSource } from '../lib/locality-availability';
import { parseLocalities, parsePollingStations } from '../lib/party-research';
import { executeElectionQuestion, parseElectionQuestion, type Answer, type QuestionQuery } from '../lib/election-questions';
import { recordQuestion, type QuestionOutcome } from '../lib/question-log';

const examples = ['מה היה קורה אם לא היה אחוז חסימה?', 'באיזה יישוב הליכוד קיבלה הכי הרבה קולות?', 'כמה קולות היו חסרים לעמך ישראל לעבור את אחוז החסימה?'];
type Reply = { answer: Answer; kind: QuestionQuery['kind']; explanation: string; time?: string };
export default function ElectionQuestions() {
  const { electionId = '' } = useParams();
  return <QuestionScreen key={electionId} electionId={electionId} />;
}
function QuestionScreen({ electionId }: { electionId: string }) {
  const navigate = useNavigate();
  const data = useElectionData(electionId, !!electionId);
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState<Reply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const changeQuestion = (value: string) => {
    active.current?.abort(); setBusy(false);
    setQuestion(value); setReply(null); setError(null); setSaveFailed(false);
  };
  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!data.results || !question.trim()) return;
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    const attempt = { id: crypto.randomUUID(), election: electionId, question: question.trim() };
    const names = { ...data.partyNames };
    for (const list of data.electionManifest!.lists) names[list.ballotLetter] ??= list.name;
    const context = { votes: data.results.voteData, names, config: data.electionConfig };
    setBusy(true); setReply(null); setError(null); setSaveFailed(false);
    let outcome: QuestionOutcome = 'failed';
    try {
      const parsed = parseElectionQuestion(attempt.question, context);
      if ('error' in parsed) {
        outcome = 'unsupported'; setError(parsed.error); return;
      }
      let places;
      if (parsed.query.kind === 'rank') {
        const source = parsed.query.level === 'stations' ? pollingStationSource(electionId) : hasLocalityData(electionId) ? `/data/${electionId}/elections.csv` : null;
        if (!source) throw new Error('אין נתוני מקומות לבחירות אלו. אפשר לשאול על התוצאות הארציות או לבחור מערכת אחרת.');
        const response = await fetch(source, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('לא הצלחתי לטעון את נתוני המקומות. אפשר לנסות שוב.');
        places = (parsed.query.level === 'stations' ? parsePollingStations : parseLocalities)(await response.text());
      }
      if (controller.signal.aborted) return;
      const answer = executeElectionQuestion(parsed.query, context, places);
      outcome = answer.rows.length ? 'answered' : 'empty';
      setReply({ answer, kind: parsed.query.kind, explanation: parsed.explanation, time: data.results.time });
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'החישוב נכשל. אפשר לנסות שוב.');
    } finally {
      if (controller.signal.aborted) outcome = 'cancelled';
      if (active.current === controller && !controller.signal.aborted) setBusy(false);
      // Recording is independent of rendering, including a cancelled geographic request.
      void recordQuestion({ ...attempt, outcome }).then(saved => {
        if (active.current === controller && !controller.signal.aborted) setSaveFailed(!saved);
      });
    }
  };
  const validElection = !!electionId && data.availableElections.includes(electionId);
  return <main className="screen election-questions" dir="rtl">
    <header className="header"><Link className="ui-link" to={validElection ? `/results/${electionId}` : '/'}>לתוצאות הבחירות</Link><ThemeToggle /></header>
    <section className="panel question-workspace">
      <div className="question-intro"><p className="subtitle">שאלות על הבחירות</p><h1>מה תרצו לדעת?</h1>
        <p>תוצאות, יישובים ותרחישים — בחרו מערכת בחירות ושאלו.</p></div>
      <ElectionSelector value={validElection ? electionId : null} elections={data.availableElections} onChange={id => navigate(`/questions/${id}`)} />
      {electionId && data.availableElections.length > 0 && !validElection && <p role="alert">מערכת הבחירות אינה קיימת. בחרו מערכת מהרשימה.</p>}
      {data.error && <p role="alert">טעינת נתוני הבחירות נכשלה. אפשר לבחור שוב או לרענן את העמוד.</p>}
      {data.refreshError && <p role="status">{data.refreshError}</p>}
      {validElection && !data.results && !data.error && <p role="status">{data.electionManifest && !['counting', 'final'].includes(data.electionManifest.phase) ? 'אין עדיין תוצאות לבחירות אלו.' : 'טוען תוצאות…'}</p>}
      <form className="question-form" onSubmit={event => { void ask(event); }}>
        <label htmlFor="election-question">השאלה שלכם</label>
        <div className="question-input-row"><input id="election-question" type="text" maxLength={600} autoComplete="off" value={question} disabled={!data.results} onChange={event => changeQuestion(event.target.value)} placeholder="מה היה קורה אם לא היה אחוז חסימה?" />
          <button type="submit" className="ui-button ui-button-primary" disabled={!validElection || !data.results || !question.trim() || busy} aria-label="שליחת השאלה">{busy ? 'מחשב…' : 'שאלו'}</button></div>
      </form>
      <div className="question-examples" aria-label="שאלות לדוגמה"><span>למשל</span>{examples.map(example => <button type="button" className="ui-button ui-button-quiet" key={example} onClick={() => { changeQuestion(example); document.getElementById('election-question')?.focus(); }}>{example}</button>)}</div>
      <p className="question-caption">השאלות נשמרות לשיפור המענה, ללא צירוף פרטים מזהים על השואל, ונגישות רק לבעל האתר. גרסת הניסיון תומכת בחלק מהניסוחים.</p>
      <div className="question-response" aria-live="polite" aria-busy={busy}>
        {busy && <p role="status">בודק את הנתונים…</p>}
        {error && <p className="question-error" role="alert">{error}</p>}
        {reply && <article><p className="question-interpretation">{reply.explanation}</p><QuestionAnswer answer={reply.answer} kind={reply.kind} />
          {data.electionManifest?.phase === 'counting' && <p className="question-caption">הספירה נמשכת. <ResultsTimestamp time={reply.time} /></p>}
        </article>}
        {saveFailed && <p className="question-caption" role="status">המענה זמין, אך שמירת השאלה נכשלה.</p>}
      </div>
    </section>
  </main>;
}
