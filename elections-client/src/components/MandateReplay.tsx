import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CalcSteps } from '../lib/calcSteps';
import { buildMandateReplay, type ReplayCandidate, type ReplayChapter, type ReplayFrame } from '../lib/mandate-replay';
import { algorithmLabel, getStablePartyColor, numberFormat, percentageFormat } from '../lib/ui-helpers';

const titles: Record<ReplayChapter, string> = {
  threshold: 'אחוז החסימה',
  quota: 'מודד למנדט',
  whole: 'מנדטים שלמים',
  agreements: 'הסכמי עודפים',
  surplus: 'מנדטים עודפים',
  split: 'חלוקה בתוך ההסכמים',
  result: 'חלוקת המנדטים',
};

const duration: Record<ReplayChapter, number> = {
  threshold: 7200,
  quota: 6500,
  whole: 7200,
  agreements: 8200,
  surplus: 6500,
  split: 9000,
  result: 0,
};

const fmt = (value: number) => numberFormat.format(value);
const ratio = (value: number) => percentageFormat.format(value);
const icons = { play: '▶︎', pause: 'Ⅱ', restart: '↻' };
const seatColor = (party: string) => ({ '--seat-color': getStablePartyColor(party) } as React.CSSProperties);

interface ReplayProps {
  steps: CalcSteps;
  getPartyName: (party: string) => string;
}

function Candidate({ candidate, name, winner }: { candidate: ReplayCandidate; name: string; winner: boolean }) {
  return (
    <div className={`mandate-replay-candidate${winner ? ' is-winner' : ''}`}>
      <span>{winner ? 'קיבל מנדט' : 'הבא בתור'}</span>
      <strong>{name}</strong>
      <bdi className="mandate-replay-score">{ratio(candidate.score)}</bdi>
      {candidate.divisor !== undefined && <bdi>{fmt(candidate.votes)} ÷ {candidate.divisor}</bdi>}
    </div>
  );
}

function Scene({ steps, frame, getPartyName }: ReplayProps & { frame: ReplayFrame }) {
  switch (frame.chapter) {
    case 'threshold': {
      const excludedVotes = steps.sumVotes - steps.participatingVotes;
      const closest = [steps.aboveBlock.at(-1), steps.belowBlock[0]];
      return <>
        <p>מתוך <strong><bdi>{fmt(steps.sumVotes)}</bdi></strong> קולות כשרים, רשימה צריכה לפחות <strong><bdi>{fmt(steps.blockThreshold)}</bdi></strong> קולות כדי לעבור את הסף ({ratio(steps.blockPercentage * 100)}%).</p>
        <div className="mandate-replay-votes">
          <div><strong><bdi>{fmt(steps.participatingVotes)}</bdi></strong><span>קולות של {steps.aboveBlock.length} רשימות שעברו</span></div>
          <div><strong><bdi>{fmt(excludedVotes)}</bdi></strong><span>קולות של {steps.belowBlock.length} רשימות מתחת לסף</span></div>
        </div>
        <div className="mandate-replay-vote-track" aria-hidden="true">
          <span style={{ inlineSize: `${100 * steps.participatingVotes / Math.max(1, steps.sumVotes)}%` }} />
        </div>
        {steps.totalMandats > 0 ? <ul className="mandate-replay-threshold-lists" aria-label="הרשימות הקרובות ביותר לסף">
          {closest.map(list => list && <li key={list.party}>
            <strong>{getPartyName(list.party)}</strong>
            <span><bdi>{fmt(list.votes)}</bdi> קולות · {list.passed ? 'עברה את הסף' : 'מתחת לסף'}</span>
          </li>)}
        </ul> : <p className="mandate-replay-outcome">אף רשימה לא עברה את הסף. אין מנדטים לחלוקה.</p>}
      </>;
    }
    case 'quota':
      return <>
        <p>מחלקים את הקולות של הרשימות שעברו את הסף במספר המושבים בכנסת.</p>
        <div className="mandate-replay-equation">
          <bdi>{fmt(steps.participatingVotes)} ÷ {steps.totalMandats} ≈ {ratio(steps.votesPerMandat)}</bdi>
          <span>קולות למנדט</span>
        </div>
      </>;
    case 'whole': {
      const example = steps.wholeMandatesRows[0];
      return <>
        <p>מחלקים את קולות כל רשימה במודד. החלק השלם של התוצאה הוא מספר המנדטים שהיא מקבלת בשלב הזה.</p>
        <div className="mandate-replay-equation">
          <strong>{getPartyName(example.party)}</strong>
          <bdi>{fmt(example.votes)} ÷ {ratio(steps.votesPerMandat)} ≈ {ratio(example.votes / steps.votesPerMandat)}</bdi>
          <span><bdi>{example.wholeMandats}</bdi> מנדטים שלמים</span>
        </div>
        <p className="mandate-replay-outcome">חולקו <bdi>{steps.totalWhole}</bdi> מנדטים שלמים. נותרו <bdi>{steps.remainingMandats}</bdi> לחלוקה.</p>
      </>;
    }
    case 'agreements':
      return <>
        <p>שתי רשימות בהסכם מחברות את הקולות ואת המנדטים השלמים שלהן ומתחרות יחד על המנדטים העודפים.</p>
        <ul className="mandate-replay-pairs">
          {steps.agreementsInfo.map(({ parties: [a, b], votes, valid }, index) => (
            <li key={index}>
              <strong>{getPartyName(a)} + {getPartyName(b)}</strong>
              <span>{valid ? <><bdi>{fmt(votes!)}</bdi> קולות יחד</> : 'ההסכם בוטל בגלל אחוז החסימה'}</span>
            </li>
          ))}
        </ul>
      </>;
    case 'surplus': {
      const { winner, runnerUp, round } = frame.award!;
      const bader = steps.algorithmUsed === 'baderOffer';
      return <>
        <p>{bader
          ? 'המנדט הולך למי שקיבל את היחס הגבוה ביותר. מחלקים את מספר הקולות במספר המנדטים שכבר הוקצו לו בתוספת אחד.'
          : 'המנדט הולך למי שנותרה לו שארית הקולות הגבוהה ביותר אחרי חלוקת המנדטים השלמים.'}</p>
        <div className="mandate-replay-race">
          <Candidate candidate={winner} name={getPartyName(winner.party)} winner />
          {runnerUp && <Candidate candidate={runnerUp} name={getPartyName(runnerUp.party)} winner={false} />}
        </div>
        <p className="mandate-replay-outcome">
          {round === steps.remainingMandats ? 'זה המנדט העודף האחרון.' : <>נותרו <bdi>{steps.remainingMandats - round}</bdi> מנדטים לחלוקה.</>}
          {runnerUp?.score === winner.score && ' המודדים שווים. ההדמיה מציגה את סדר ההקצאה של החישוב באתר.'}
        </p>
      </>;
    }
    case 'split':
      return <>
        <p>המנדטים העודפים שזכה בהם כל הסכם מחולקים בין שתי הרשימות שלו. כאן אפשר לראות את התוצאה לכל רשימה.</p>
        <ul className="mandate-replay-pairs">
          {steps.agreementSplits.map(({ parties: [a, b], totalMandats, aResult, bResult }) => {
            const aWhole = steps.wholeMandatesRows.find(row => row.party === a)!.wholeMandats;
            const bWhole = steps.wholeMandatesRows.find(row => row.party === b)!.wholeMandats;
            return (
              <li key={`${a}+${b}`}>
                <strong>{getPartyName(a)} + {getPartyName(b)} · <bdi>{totalMandats}</bdi> מנדטים</strong>
                <span>{getPartyName(a)} <bdi dir="ltr">{aWhole} → {aResult.mandats}</bdi> · {getPartyName(b)} <bdi dir="ltr">{bWhole} → {bResult.mandats}</bdi></span>
              </li>
            );
          })}
        </ul>
      </>;
    case 'result':
      return <p>כל <strong>{steps.totalMandats}</strong> המנדטים חולקו. כל משבצת מייצגת מנדט אחד, והמקרא מציג את המספר שקיבלה כל רשימה.</p>;
  }
}

function Seats({ frame, total, getPartyName }: { frame: ReplayFrame; total: number; getPartyName: ReplayProps['getPartyName'] }) {
  const allocated = frame.seatOwners.length;

  return (
    <div className="mandate-replay-board">
      <div className="mandate-replay-board-heading">
        <strong>מושבי הכנסת</strong>
        <span><bdi>{allocated} / {total}</bdi> חולקו</span>
      </div>
      <div className="mandate-replay-seats" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => {
          const owner = frame.seatOwners[index];
          const awarded = frame.award && index === allocated - 1;
          return <span key={index} className={awarded ? 'is-awarded' : undefined}>
            {owner && <span key={owner} className="mandate-replay-seat-fill" style={{
              ...seatColor(owner), animationDelay: `${frame.chapter === 'whole' ? index * 4 : 0}ms`,
            }} />}
          </span>;
        })}
      </div>
      {allocated > 0 && <ul className="mandate-replay-legend" aria-label="מנדטים לפי רשימה או הסכם">
        {frame.allocation.filter(({ seats }) => seats > 0).map(({ party, seats }) => (
          <li key={party} style={seatColor(party)}><span>{getPartyName(party)}</span><bdi>{seats}</bdi></li>
        ))}
      </ul>}
    </div>
  );
}

function ReplayPlayer({ steps, getPartyName }: ReplayProps) {
  const frames = useMemo(() => buildMandateReplay(steps), [steps]);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(true);
  const index = Math.min(position, frames.length - 1);
  const last = index === frames.length - 1;
  const frame = frames[index];
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  useEffect(() => {
    if (!playing || last) return;
    const timer = window.setTimeout(() => setPosition(index + 1), duration[frame.chapter]);
    return () => window.clearTimeout(timer);
  }, [playing, index, last, frame.chapter]);

  const seek = (next: number) => {
    setPlaying(false);
    setPosition(next);
  };

  const playPause = () => {
    if (last) {
      setPosition(0);
      setPlaying(true);
    } else {
      setPlaying(value => !value);
    }
  };

  return (
    <div className="mandate-replay-player">
      <div className="mandate-replay-topline">
        <span>{algorithmLabel(steps.algorithmUsed)}</span>
        <label>שלב <bdi>{index + 1} / {frames.length}</bdi>
          <input type="range" min={0} max={frames.length - 1} value={index} disabled={frames.length === 1}
            aria-valuetext={`${index + 1} מתוך ${frames.length}, ${titles[frame.chapter]}`}
            onChange={event => seek(Number(event.target.value))} />
        </label>
      </div>
      {frames.length > 1 && <div className="mandate-replay-controls">
        <button type="button" className="ui-button ui-button-quiet" disabled={index === 0} onClick={() => seek(index - 1)}>הקודם</button>
        <button type="button" className="ui-button ui-button-primary" onClick={playPause}>
          <span aria-hidden="true">{last ? icons.restart : playing ? icons.pause : icons.play}</span>{last ? 'מההתחלה' : playing ? 'השהיה' : 'המשך'}
        </button>
        <button type="button" className="ui-button ui-button-quiet" disabled={last} onClick={() => seek(index + 1)}>הבא</button>
      </div>}
      <div className="mandate-replay-stage">
        <div className="mandate-replay-script">
          <h3 ref={heading} tabIndex={-1} aria-live="polite">
            {titles[frame.chapter]}{frame.award && <> · <bdi>{frame.award.round} / {steps.remainingMandats}</bdi></>}
          </h3>
          <div key={index} className="mandate-replay-scene">
            <Scene steps={steps} frame={frame} getPartyName={getPartyName} />
          </div>
        </div>
        {steps.totalMandats > 0 && <Seats frame={frame} total={steps.totalMandats} getPartyName={getPartyName} />}
      </div>
    </div>
  );
}

export default function MandateReplay(props: ReplayProps) {
  const [snapshot, setSnapshot] = useState<ReplayProps | null>(null);
  const open = snapshot !== null;
  const id = useId();

  return (
    <div className="mandate-replay">
      <button type="button" className="ui-button ui-button-quiet mandate-replay-launch" aria-expanded={open}
        aria-controls={id} onClick={() => setSnapshot(open ? null : props)}>
        <span aria-hidden="true">{open ? '×' : icons.play}</span>
        {open ? 'סגירת ההדמיה' : 'הפעלת ההדמיה'}
      </button>
      <div id={id} hidden={!open}>{snapshot && <ReplayPlayer {...snapshot} />}</div>
    </div>
  );
}
