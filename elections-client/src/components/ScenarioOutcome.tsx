import React from 'react';
import type { AnalysisInput, AutomaticScenario, ScenarioBaseline } from '../lib/automatic-scenarios';
import { computeBlocOverview } from '../lib/bloc-overview';
import { numberFormat, percentageFormat } from '../lib/ui-helpers';

const signed = (value: number) => `${value > 0 ? '+' : '−'}${numberFormat.format(Math.abs(value))}`;

interface Props {
  scenario: AutomaticScenario;
  baseline: ScenarioBaseline;
  input: AnalysisInput;
  getPartyName: (key: string) => string;
  showScenario: boolean;
}

function SeatChanges({ rows, baseline, getPartyName, showScenario }: {
  rows: [string, number][];
} & Pick<Props, 'baseline' | 'getPartyName' | 'showScenario'>) {
  const gaining = rows[0][1] > 0;
  return (
    <div className={`scenario-seat-group ${gaining ? 'is-gain' : 'is-loss'}`}>
      <p>{gaining ? 'מרוויחות בתרחיש' : 'מאבדות בתרחיש'}</p>
      <dl>
        {rows.map(([key, delta]) => (
          <div key={key}>
            <dt>{getPartyName(key)}</dt>
            <dd>
              <bdi className="scenario-value" key={String(showScenario)}>{(baseline.seats[key] ?? 0) + (showScenario ? delta : 0)}</bdi>
              <bdi className="scenario-delta" hidden={!showScenario}>{signed(delta)}</bdi>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function ScenarioOutcome({ scenario, baseline, input, getPartyName, showScenario }: Props) {
  const { party, delta, threshold, seatDeltas, blocDeltas } = scenario;
  const changedSeats = Object.entries(seatDeltas);
  const losing = changedSeats.filter(([, change]) => change < 0);
  const gaining = changedSeats.filter(([, change]) => change > 0);
  const gains = gaining.reduce((total, [, change]) => total + change, 0);
  const losses = losing.reduce((total, [, change]) => total - change, 0);
  const reallocated = gains > 0 && gains === losses;

  const blocName = (key: string) => input.blocs.blocks[key].label;
  const blocs = Object.entries(blocDeltas).map(([key, change]) => ({
    key, label: blocName(key), before: baseline.blocs[key], change, combined: false,
  }));
  const combined = computeBlocOverview(input.blocs, baseline.blocs).flatMap(({ key, complementaryKeys, combinedSeats }) => {
    if (!complementaryKeys.length) return [];
    const members = [key, ...complementaryKeys];
    if (!members.some(member => blocDeltas[member])) return [];
    return [{
      key: members.join('+'),
      label: `${blocName(key)} עם ${complementaryKeys.map(blocName).join(' ו')}`,
      before: combinedSeats,
      change: members.reduce((total, member) => total + (blocDeltas[member] ?? 0), 0),
      combined: true,
    }];
  });

  const inputValue = party !== undefined
    ? numberFormat.format(input.voteData[party].votes + (showScenario ? delta : 0))
    : `${percentageFormat.format((showScenario ? threshold : input.config.blockPercentage) * 100)}%`;
  return (
    <>
      <div className="scenario-input">
        <span>{party ? `קולות ל${getPartyName(party)}` : 'אחוז החסימה'}</span>
        <strong className="scenario-value" key={String(showScenario)}>
          <bdi>{inputValue}</bdi>
        </strong>
      </div>
      <div className="scenario-seats">
        <div className="scenario-section-heading">
          <h4>מנדטים לפי רשימה</h4>
          {reallocated && <span>{gains === 1 ? 'מנדט אחד עובר בתרחיש' : `${gains} מנדטים מחולקים מחדש בתרחיש`}</span>}
        </div>
        <div className="scenario-seat-layout" data-transfer={reallocated}>
          {losing.length > 0 && <SeatChanges rows={losing} baseline={baseline} getPartyName={getPartyName} showScenario={showScenario} />}
          {reallocated && <div className="scenario-transfer" aria-hidden="true">
            <span className="scenario-token">{gains}</span>
          </div>}
          {gaining.length > 0 && <SeatChanges rows={gaining} baseline={baseline} getPartyName={getPartyName} showScenario={showScenario} />}
        </div>
      </div>
      <div className="scenario-blocs">
        <h4>מאזן הגושים</h4>
        {blocs.length === 0 && <p>אין שינוי במאזן הגושים בתרחיש הזה.</p>}
        {blocs.length > 0 && <p className="scenario-majority-note">61 מנדטים לרוב</p>}
        {[...blocs, ...combined].map(({ key, label, before, change, combined: isCombined }) => {
          const count = before + (showScenario ? change : 0);
          const fill = { '--baseline-fill': before / 120, '--current-fill': count / 120 } as React.CSSProperties;
          return (
            <div className="scenario-bloc" key={key}>
              <div className="scenario-bloc-label">
                <span>{label}</span>
                <span className="scenario-bloc-result">
                  {count >= 61 && <span className="scenario-majority">{isCombined ? 'רוב חוסם' : 'רוב'}</span>}
                  <strong><bdi>{count}</bdi> מנדטים</strong>
                  <bdi className={change > 0 ? 'is-gain' : 'is-loss'} hidden={!showScenario || change === 0}>{signed(change)}</bdi>
                </span>
              </div>
              <div className="scenario-bloc-track" style={fill} aria-hidden="true"><span /></div>
            </div>
          );
        })}
      </div>
    </>
  );
}
