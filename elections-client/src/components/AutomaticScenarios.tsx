import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { selectScenarios, type AnalysisInput, type AutomaticScenario, type ScenarioAnalysis } from '../lib/automatic-scenarios';
import { encodeSharedScenario } from '../lib/shared-scenario';
import { numberFormat } from '../lib/ui-helpers';

interface Props extends AnalysisInput {
  election: string;
  getPartyName: (party: string) => string;
  demo?: boolean;
  counting?: boolean;
}
const signed = (value: number) => `${value > 0 ? '+' : '−'}${numberFormat.format(Math.abs(value))}`;
const percent = (value: number) => (value * 100).toLocaleString('he-IL', { maximumFractionDigits: 2 });

export default function AutomaticScenarios({ election, getPartyName, demo = false, counting, ...input }: Props) {
  const navigate = useNavigate();
  const payload = JSON.stringify(input);
  const [state, setState] = useState<{ payload: string; analysis?: ScenarioAnalysis; error?: boolean } | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let worker: Worker | undefined;
    try {
      // Terminating the old worker also cancels analysis of stale live results.
      worker = new Worker(new URL('../workers/automatic-scenarios.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => { if (active) setState({ payload, ...data }); };
      worker.onerror = event => { event.preventDefault(); if (active) setState({ payload, error: true }); };
      worker.postMessage(JSON.parse(payload));
    } catch { setState({ payload, error: true }); }
    return () => { active = false; worker?.terminate(); };
  }, [payload, attempt]);
  const current = state?.payload === payload ? state : null;
  const scenarios = current?.analysis ? selectScenarios(current.analysis, !!input.party).filter(scenario =>
    !input.party || scenario.party || (scenario.seatDeltas[input.party] ?? 0) !== 0) : [];
  const open = async (scenario: AutomaticScenario) => {
    setOpening(true); setOpenError(false);
    try {
      const base = { voteData: Object.fromEntries(Object.entries(input.voteData).map(([key, value]) =>
        [key, { ...value, name: getPartyName(key) }])), config: input.config };
      const voteData = { ...base.voteData };
      if (scenario.party) voteData[scenario.party] = { ...voteData[scenario.party], votes: voteData[scenario.party].votes + scenario.delta };
      const token = await encodeSharedScenario({ version: 1, election, demo, base,
        scenario: { voteData, config: { ...input.config, blockPercentage: scenario.threshold ?? input.config.blockPercentage } } });
      navigate(`/simulator/${election}#scenario=${token}`);
    } catch { setOpenError(true); }
    finally { setOpening(false); }
  };
  const blocName = (key: string) => input.blocs.blocks[key]?.label || key;
  const goalLabel = (goal: string) => {
    const [type, key, direction] = goal.split(':');
    if (type === 'majority') return `${direction === 'gain' ? 'יצירת' : 'ביטול'} רוב ל${key.split('+').map(blocName).join(' + ')}`;
    if (type === 'transfer') return `שינוי במאזן ${blocName(key)} ו${blocName(direction)}`;
    return key === 'gain' ? 'תוספת מנדט לרשימה' : 'אובדן מנדט לרשימה';
  };
  return <section className="panel automatic-scenarios" aria-label="תרחישים קרובים">
    <h2>{input.party ? 'מה היה משתנה עם קולות נוספים או פחות?' : 'מה היה משנה את התוצאות?'}</h2>
    {counting && <p className="summary-caption">מחושב לפי הקולות שפורסמו עד כה; התרחישים מתעדכנים עם הספירה.</p>}
    {!current && <p role="status">מחשב תרחישים קרובים…</p>}
    {current?.error && <p role="alert">חישוב התרחישים נכשל. <button type="button" className="ghost" onClick={() => setAttempt(value => value + 1)}>ניסיון נוסף</button></p>}
    {current?.analysis && !scenarios.length && <p>לא נמצאו תרחישים שמשנים מנדטים בטווח הקרוב.</p>}
    <div className="automatic-scenario-grid">
      {scenarios.map(scenario => <article className="automatic-scenario" key={`${scenario.party || 'threshold'}:${scenario.delta}:${scenario.threshold}`}>
        <div className="automatic-scenario-heading">
          <h3>{scenario.party ? <>אילו {getPartyName(scenario.party)} הייתה מקבלת <bdi>{numberFormat.format(Math.abs(scenario.delta))}</bdi> קולות {scenario.delta > 0 ? 'נוספים' : 'פחות'}</>
            : scenario.threshold === 0 ? 'ללא אחוז חסימה' : <>אחוז חסימה של <bdi>{percent(scenario.threshold!)}%</bdi></>}</h3>
          <details className="automatic-scenario-details">
            <summary>פרטי התרחיש</summary>
            {scenario.party && <p>{percent(scenario.relativeDistance)}% מקולות הרשימה · {percent(scenario.distance)}% מהקולות הכשרים בארץ</p>}
            <p>{[...new Set(scenario.goals.map(goalLabel))].join(' · ') || (scenario.threshold !== undefined ? 'חלוקת המנדטים לפי הכלל החדש' : 'השינוי הקרוב במנדטים')}</p>
          </details>
        </div>
        <div className="automatic-scenario-outcome">
          <p className="automatic-scenario-caption">השינוי במנדטים</p>
          <p className="automatic-seat-deltas" aria-label="השינוי במנדטים לפי רשימה">{Object.entries(scenario.seatDeltas).map(([key, delta]) =>
            <span key={key} className={delta > 0 ? 'gain' : 'lose'}><span>{getPartyName(key)}</span> <bdi>{signed(delta)}</bdi></span>)}</p>
          {!!Object.keys(scenario.blocDeltas).length && <p className="automatic-bloc-deltas"><span>מאזן הגושים:</span>{Object.entries(scenario.blocDeltas).map(([key, delta]) =>
            <span key={key}>{blocName(key)} <bdi className={delta > 0 ? 'gain' : 'lose'}>{signed(delta)}</bdi></span>)}</p>}
        </div>
        <button type="button" className="ghost automatic-scenario-open" disabled={opening} onClick={() => open(scenario)}>פתיחה בסימולטור</button>
      </article>)}
    </div>
    {openError && <p role="alert">פתיחת התרחיש נכשלה. אפשר לנסות שוב.</p>}
    <details><summary>איך נבחרים התרחישים?</summary>
      <p>מחפשים שינוי של עד 20% מקולות הרשימה ועד 1% מהקולות הכשרים בארץ, כאשר קולות שאר הרשימות נשארים קבועים. מכל אבן דרך נבחר השינוי הקטן ביותר: שינוי בין גושים, יצירה או ביטול של רוב של 61{input.party ? ', וגם רווח או הפסד מנדט לרשימה' : ''}.</p>
      <p>הדירוג לפי מדרגות קרבה: עד 0.1%, עד 0.5% ועד 1% מהקולות הארציים. בכל מדרגה שינוי רוב קודם לשינוי בין גושים. תוצאות זהות מופיעות פעם אחת. שיוך הרשימות לגושים הוא לפי ההגדרות המוצגות באתר.</p>
      <p>שינוי אחוז החסימה נבדק בנפרד, בצעדים של 0.01 נקודת אחוז, לצד ביטול אחוז החסימה. כל ההפרשים הם מול התוצאות המקוריות.</p>
    </details>
  </section>;
}