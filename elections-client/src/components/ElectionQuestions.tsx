import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppHeader from './AppHeader';
import ResultsTimestamp from './ResultsTimestamp';
import QuestionAnswer from './QuestionAnswer';
import QuestionInput from './QuestionInput';
import QuestionShare from './QuestionShare';
import { questionHref } from '../lib/question-link';
import BetaBadge from './BetaBadge';
import { useQuestionPlaces } from '../hooks/use-question-places';
import { useElectionData } from '../hooks/use-election-data';
import partyNamesAll from '../data/party-names.json';
import { insightNeedsPlaces } from '../lib/question-insights';
import { hasLocalityData, pollingStationSource } from '../lib/locality-availability';
import { parseLocalities, parsePollingStations } from '../lib/party-research';
import { executeElectionQuestion, parseElectionQuestion, type Answer, type AnswerLink, type QuestionQuery } from '../lib/election-questions';
import type { PreviousElection } from '../lib/question-insights';
import { recordQuestion, type QuestionOutcome } from '../lib/question-log';
import { phaseHasResults } from '../lib/election-manifest';
import { questionAnswerLinks } from '../lib/question-answer-links';
import { questionScenarioHref } from '../lib/question-scenario';
import { loadComparisonElection } from '../lib/comparison-data';
import { buildQuestionExamples, selectQuestionExamples } from '../lib/question-examples';

type Reply = { links: AnswerLink[]; answer: Answer; kind: QuestionQuery['kind']; explanation: string; time?: string; scenarioHref?: string; scenarioLinkFailed?: boolean };
export default function ElectionQuestions() {
  const { electionId = '' } = useParams();
  const [params] = useSearchParams();
  const initialQuestion = params.get('q') ?? '';
  return <QuestionScreen key={electionId} electionId={electionId} initialQuestion={initialQuestion} />;
}
function QuestionScreen({ electionId, initialQuestion }: { electionId: string; initialQuestion: string }) {
  const navigate = useNavigate();
  const data = useElectionData(electionId, !!electionId);
  const [exampleSeed] = useState(() => Math.floor(Math.random() * 4294967296));
  const examples = useMemo(() => {
    const names = { ...data.partyNames };
    for (const list of data.electionManifest?.lists ?? []) names[list.ballotLetter] ??= list.name;
    return selectQuestionExamples(data.results ? buildQuestionExamples({ votes: data.results.voteData, names, config: data.electionConfig, electionId, blocs: data.blocs }) : [], exampleSeed);
  }, [data.results, data.partyNames, data.electionManifest, data.electionConfig, data.blocs, electionId, exampleSeed]);
  const [question, setQuestion] = useState(() => initialQuestion.slice(0, 600));
  const autoStarted = useRef(false);
  const previousLinkedQuestion = useRef(initialQuestion);
  const places = useQuestionPlaces(data.results ? electionId : undefined, question.includes('בקלפי'));
  const [reply, setReply] = useState<Reply | null>(null);
  const [error, setError] = useState<string | null>(initialQuestion.length > 600 ? 'השאלה בקישור ארוכה מדי. אפשר לערוך שאלה של עד 600 תווים ולשלוח אותה.' : null);
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const active = useRef<AbortController | null>(null);
  const completionContext = useMemo(() => data.results ? {
    votes: data.results.voteData,
    names: { ...Object.fromEntries((data.electionManifest?.lists ?? []).map(list => [list.ballotLetter, list.name])), ...data.partyNames },
    config: data.electionConfig, electionId, blocs: data.blocs,
  } : undefined, [data.results, data.electionManifest, data.partyNames, data.electionConfig, data.blocs, electionId]);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    if (previousLinkedQuestion.current === initialQuestion) return;
    previousLinkedQuestion.current = initialQuestion;
    autoStarted.current = false;
    active.current?.abort(); setBusy(false);
    setQuestion(initialQuestion.slice(0, 600)); setReply(null); setSaveFailed(false);
    setError(initialQuestion.length > 600 ? 'השאלה בקישור ארוכה מדי. אפשר לערוך שאלה של עד 600 תווים ולשלוח אותה.' : null);
  }, [initialQuestion]);
  const changeQuestion = (value: string) => {
    autoStarted.current = true;
    active.current?.abort(); setBusy(false);
    setQuestion(value); setReply(null); setError(null); setSaveFailed(false);
  };
  const chooseExample = (example: string) => {
    changeQuestion(example); document.getElementById('election-question')?.focus();
  };
  const exampleButton = (example: string) => <button type="button" className="ui-button ui-button-quiet" key={example} onClick={() => chooseExample(example)}>{example}</button>;
  const ask = useCallback(async (text: string) => {
    if (!data.results || !text.trim()) return;
    autoStarted.current = true;
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    const attempt = { id: crypto.randomUUID(), election: electionId, question: text.trim() };
    const names = { ...data.partyNames };
    for (const list of data.electionManifest!.lists) names[list.ballotLetter] ??= list.name;
    const context = { votes: data.results.voteData, names, config: data.electionConfig, electionId, blocs: data.blocs };
    setBusy(true); setReply(null); setError(null); setSaveFailed(false);
    let outcome: QuestionOutcome = 'failed';
    try {
      const parsed = parseElectionQuestion(attempt.question, context);
      if ('error' in parsed) {
        outcome = 'unsupported'; setError(parsed.error); return;
      }
      let places;
      if (parsed.query.kind === 'rank' || parsed.query.kind === 'below-threshold-winners' || insightNeedsPlaces(parsed.query)) {
        const source = ('level' in parsed.query && parsed.query.level === 'stations') ? pollingStationSource(electionId) : hasLocalityData(electionId) ? `/data/${electionId}/elections.csv` : null;
        if (!source) throw new Error('אין נתוני מקומות לבחירות אלו. אפשר לשאול על התוצאות הארציות או לבחור מערכת אחרת.');
        const response = await fetch(source, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('לא הצלחתי לטעון את נתוני המקומות. אפשר לנסות שוב.');
        places = (('level' in parsed.query && parsed.query.level === 'stations') ? parsePollingStations : parseLocalities)(await response.text());
      }
      let previous: PreviousElection | undefined;
      const comparison = (parsed.query.kind === 'comparison' || parsed.query.kind === 'comparison-scenario') && parsed.query.source
        ? await loadComparisonElection(parsed.query.source, controller.signal) : undefined;
      if (parsed.query.kind === 'insight' && ['strengthened', 'weakened'].includes(parsed.query.metric)) {
        const id = String(Number(electionId) - 1);
        if (!hasLocalityData(id)) throw new Error('אין נתוני יישובים למערכת הבחירות הקודמת.');
        const response = await fetch(`/data/${id}/elections.csv`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('לא הצלחתי לטעון את נתוני הבחירות הקודמות.');
        previous = { id, names: (partyNamesAll as Record<string, Record<string, string>>)[id] ?? {}, places: parseLocalities(await response.text()) };
      }
      if (controller.signal.aborted) return;
      const answer = executeElectionQuestion(parsed.query, { ...context, previous, comparison }, places);
      outcome = answer.rows.length ? 'answered' : 'empty';
      let scenarioHref: string | undefined;
      let scenarioLinkFailed = false;
      try { scenarioHref = await questionScenarioHref(answer, context, electionId); }
      catch { scenarioLinkFailed = true; }
      if (controller.signal.aborted) return;
      setReply({ answer, links: questionAnswerLinks(parsed.query, answer, context, electionId), scenarioHref, scenarioLinkFailed, kind: parsed.query.kind, explanation: parsed.explanation, time: data.results.time });
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
  }, [data.results, data.partyNames, data.electionManifest, data.electionConfig, data.blocs, electionId]);
  useEffect(() => {
    if (autoStarted.current || !data.results || !initialQuestion.trim() || initialQuestion.length > 600) return;
    autoStarted.current = true;
    void ask(initialQuestion);
  }, [ask, data.results, initialQuestion]);
  const validElection = !!electionId && data.availableElections.includes(electionId);
  return <div className="screen election-questions" dir="rtl">
    <AppHeader statusText="שאלות על הבחירות" showSimulator={!!data.electionManifest && phaseHasResults(data.electionManifest.phase)}
      isEdited={false} currentElection={validElection ? electionId : null}
      availableElections={data.availableElections} viewMode="questions"
      setCurrentElection={id => navigate(initialQuestion ? questionHref(id, initialQuestion) : `/questions/${id}`)}
      setViewMode={mode => navigate(mode === 'summary' ? '/summary' : validElection ? `/${mode}/${electionId}` : mode === 'questions' ? '/questions' : '/')} />
    <main className="panel question-workspace">
      <div className="question-intro"><p className="subtitle">שאלות על הבחירות <BetaBadge /></p><h1>מה תרצו לדעת?</h1>
        <p>תוצאות, יישובים ותרחישים — בחרו מערכת בחירות ושאלו.</p></div>
      <aside className="question-beta-notice" aria-label="גרסת בטא">
        <strong>גרסת בטא — המענה עדיין ניסיוני</strong>
        <p>לא כל שאלה או ניסוח נתמכים, והתשובות עלולות להיות שגויות או חלקיות. מומלץ לבדוק אותן מול נתוני התוצאות באתר.</p>
      </aside>
      {electionId && data.availableElections.length > 0 && !validElection && <p role="alert">מערכת הבחירות אינה קיימת. בחרו מערכת מהרשימה.</p>}
      {data.error && <p role="alert">טעינת נתוני הבחירות נכשלה. אפשר לבחור שוב או לרענן את העמוד.</p>}
      {data.refreshError && <p role="status">{data.refreshError}</p>}
      {validElection && !data.results && !data.error && <p role="status">{data.electionManifest && !['counting', 'final'].includes(data.electionManifest.phase) ? 'אין עדיין תוצאות לבחירות אלו.' : 'טוען תוצאות…'}</p>}
      <form className="question-form" onSubmit={event => {
        event.preventDefault();
        const submitted = question.trim();
        if (submitted && initialQuestion !== submitted) navigate(questionHref(electionId, submitted));
        else void ask(submitted);
      }}>
        <label htmlFor="election-question">השאלה שלכם</label>
        <QuestionInput value={question} onChange={changeQuestion} busy={busy} disabled={!validElection || !data.results}
          context={completionContext} places={places} placesLoading={places.loading} placesError={places.error} retryPlaces={places.retry} />
      </form>
      <QuestionShare election={electionId} question={question} disabled={!validElection} />
      {examples.featured.length > 0 && <section className="question-suggestions" aria-label="שאלות לדוגמה">
        <div className="question-examples"><span>למשל</span>{examples.featured.map(exampleButton)}</div>
        {examples.remaining.length > 0 && <details className="question-example-catalog">
          <summary>עוד שאלות לדוגמה <span>({examples.remaining.reduce((sum, group) => sum + group.questions.length, 0)})</span></summary>
          {examples.remaining.map(group => <section key={group.title} className="question-example-group">
            <h2>{group.title}</h2><div className="question-examples">{group.questions.map(exampleButton)}</div>
          </section>)}
        </details>}
      </section>}
      <p className="question-caption">השאלות נשמרות לשיפור המענה, ללא צירוף פרטים מזהים על השואל, ונגישות רק לבעל האתר.</p>
      <div className="question-response" aria-live="polite" aria-busy={busy}>
        {busy && <p role="status">בודק את הנתונים…</p>}
        {error && <p className="question-error" role="alert">{error}</p>}
        {reply && <article><p className="question-interpretation">{reply.explanation}</p><QuestionAnswer answer={reply.answer} kind={reply.kind} /><p className="question-answer-note">{reply.answer.note}</p>
          {!reply.scenarioHref && reply.links.length > 0 && <div className="question-answer-links">{reply.links.map(link => <Link key={link.href} className="ui-link ui-button ui-button-quiet" to={link.href}>{link.label}</Link>)}</div>}
          {reply.scenarioHref && <Link className="ui-link ui-button ui-button-quiet" to={reply.scenarioHref}>פתיחת התרחיש בסימולטור</Link>}
          {reply.scenarioLinkFailed && <p className="question-caption" role="status">התשובה זמינה, אך יצירת הקישור לסימולטור נכשלה. אפשר לשלוח שוב את השאלה.</p>}
          {data.electionManifest?.phase === 'counting' && <p className="question-caption">הספירה נמשכת. <ResultsTimestamp time={reply.time} /></p>}
        </article>}
        {saveFailed && <p className="question-caption" role="status">המענה זמין, אך שמירת השאלה נכשלה.</p>}
      </div>
    </main>
  </div>;
}
