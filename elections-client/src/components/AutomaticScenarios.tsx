import React, { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { selectScenarios, type AnalysisInput, type AutomaticScenario, type ScenarioAnalysis, type ScenarioBaseline } from '../lib/automatic-scenarios';
import { encodeSharedScenario } from '../lib/shared-scenario';
import { numberFormat, percentageFormat } from '../lib/ui-helpers';
import ScenarioOutcome from './ScenarioOutcome';

interface Props extends AnalysisInput {
  election: string;
  getPartyName: (party: string) => string;
  demo?: boolean;
  counting?: boolean;
}
const percent = (value: number) => percentageFormat.format(value * 100);
const scenarioKey = ({ party, delta, threshold }: AutomaticScenario) => JSON.stringify([party, delta, threshold]);

function ScenarioExplorer({ scenarios, baseline, input, getPartyName, opening, onOpen }: {
  scenarios: AutomaticScenario[];
  baseline: ScenarioBaseline;
  input: AnalysisInput;
  getPartyName: Props['getPartyName'];
  opening: boolean;
  onOpen: (scenario: AutomaticScenario) => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showScenario, setShowScenario] = useState(false);
  const scenario = scenarios.find(item => scenarioKey(item) === selectedKey) ?? scenarios[0];
  const titleId = useId();
  const cardId = useId();
  const blocName = (key: string) => input.blocs.blocks[key]?.label || key;
  const goalLabel = (goal: string) => {
    const [type, key, direction] = goal.split(':');
    if (type === 'majority') return `${direction === 'gain' ? 'יצירת' : 'ביטול'} רוב ל${key.split('+').map(blocName).join(' + ')}`;
    if (type === 'transfer') return `שינוי במאזן ${blocName(key)} ו${blocName(direction)}`;
    return key === 'gain' ? 'תוספת מנדט לרשימה' : 'אובדן מנדט לרשימה';
  };
  const { party, delta, threshold } = scenario;

  return (
    <div className="scenario-explorer">
      <div className="scenario-picker" role="group" aria-label="בחירת תרחיש">
        {scenarios.map(item => (
          <button key={scenarioKey(item)} type="button" className="ui-button ui-button-quiet"
            aria-controls={cardId} aria-pressed={item === scenario}
            onClick={() => { setSelectedKey(scenarioKey(item)); setShowScenario(true); }}>
            {item.party !== undefined ? <><strong>{getPartyName(item.party)}</strong>
              <span><bdi>{item.delta > 0 ? '+' : '−'}{numberFormat.format(Math.abs(item.delta))}</bdi> קולות</span></>
              : item.threshold === 0 ? <strong>ללא אחוז חסימה</strong>
                : <><strong>אחוז חסימה</strong><span><bdi>{percent(item.threshold)}%</bdi></span></>}
          </button>
        ))}
      </div>
      <article className="scenario-card" id={cardId} aria-labelledby={titleId}
        key={scenarioKey(scenario)} data-outcome={showScenario ? 'scenario' : 'actual'}>
        <header className="scenario-card-header">
          <h3 id={titleId}>{party !== undefined ? <>אילו {getPartyName(party)} הייתה מקבלת <bdi>{numberFormat.format(Math.abs(delta))}</bdi> קולות {delta > 0 ? 'נוספים' : 'פחות'}</>
            : threshold === 0 ? 'אילו לא היה אחוז חסימה' : <>אילו אחוז החסימה היה <bdi>{percent(threshold)}%</bdi></>}</h3>
          <div className="scenario-compare" role="group" aria-label="השוואת תוצאות">
            <button type="button" className="ui-button ui-button-quiet" aria-pressed={!showScenario} onClick={() => setShowScenario(false)}>בפועל</button>
            <button type="button" className="ui-button ui-button-quiet" aria-pressed={showScenario} onClick={() => setShowScenario(true)}>בתרחיש</button>
          </div>
        </header>
        <ScenarioOutcome scenario={scenario} baseline={baseline} input={input} getPartyName={getPartyName} showScenario={showScenario} />
        <footer className="scenario-card-footer">
          <details className="automatic-scenario-details">
            <summary>פרטי התרחיש</summary>
            {party && <p>{percent(scenario.relativeDistance)}% מקולות הרשימה · {percent(scenario.distance)}% מהקולות הכשרים בארץ</p>}
            <p>{[...new Set(scenario.goals.map(goalLabel))].join(' · ') || 'חלוקת המנדטים לפי הכלל החדש'}</p>
          </details>
          <button type="button" className="ui-button ui-button-quiet" disabled={opening} onClick={() => onOpen(scenario)}>פתיחה בסימולטור</button>
        </footer>
      </article>
    </div>
  );
}

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
  return <section className="panel automatic-scenarios" aria-label="תרחישים קרובים">
    <h2>{input.party ? 'מה היה משתנה עם קולות נוספים או פחות?' : 'מה היה משנה את התוצאות?'}</h2>
    {counting && <p className="summary-caption">מחושב לפי הקולות שפורסמו עד כה; התרחישים מתעדכנים עם הספירה.</p>}
    {!current && <p role="status">מחשב תרחישים קרובים…</p>}
    {current?.error && <p role="alert">חישוב התרחישים נכשל. <button type="button" className="ghost" onClick={() => setAttempt(value => value + 1)}>ניסיון נוסף</button></p>}
    {current?.analysis && !scenarios.length && <p>לא נמצאו תרחישים שמשנים מנדטים בטווח הקרוב.</p>}
    {current?.analysis && scenarios.length > 0 && <ScenarioExplorer scenarios={scenarios} baseline={current.analysis.baseline}
      input={input} getPartyName={getPartyName} opening={opening} onOpen={open} />}
    {openError && <p role="alert">פתיחת התרחיש נכשלה. אפשר לנסות שוב.</p>}
    <details><summary>איך נבחרים התרחישים?</summary>
      <p>מחפשים שינוי של עד 20% מקולות הרשימה ועד 1% מהקולות הכשרים בארץ, כאשר קולות שאר הרשימות נשארים קבועים. מכל אבן דרך נבחר השינוי הקטן ביותר: שינוי בין גושים, יצירה או ביטול של רוב של 61{input.party ? ', וגם רווח או הפסד מנדט לרשימה' : ''}.</p>
      <p>הדירוג לפי מדרגות קרבה: עד 0.1%, עד 0.5% ועד 1% מהקולות הארציים. בכל מדרגה שינוי רוב קודם לשינוי בין גושים. תוצאות זהות מופיעות פעם אחת. שיוך הרשימות לגושים הוא לפי ההגדרות המוצגות באתר.</p>
      <p>שינוי אחוז החסימה נבדק בנפרד, בצעדים של 0.01 נקודת אחוז, לצד ביטול אחוז החסימה. כל ההפרשים הם מול התוצאות המקוריות.</p>
    </details>
  </section>;
}
