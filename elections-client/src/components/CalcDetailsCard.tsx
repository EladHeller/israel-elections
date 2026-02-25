import React, { useState } from 'react';
import { numberFormat } from '../lib/ui-helpers';
import { buildCalcSteps, type CalcSteps, type AgreementSplit } from '../lib/calcSteps';
import type { VoteData } from '../types';

const NON_PARTY_KEYS = new Set(['﻿סמל ועדה', 'סמל ועדה']);

const pctFmt = new Intl.NumberFormat('he-IL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});
const ratioFmt = new Intl.NumberFormat('he-IL', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

interface StepSectionProps {
  number: number;
  title: string;
  badge?: string;
  children: React.ReactNode;
}

const StepSection: React.FC<StepSectionProps> = ({
  number,
  title,
  badge,
  children,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="calc-step">
      <button
        type="button"
        className="calc-step-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="calc-step-num">{number}</span>
        <span className="calc-step-title">{title}</span>
        {badge != null && <span className="calc-step-badge">{badge}</span>}
        <span className="calc-step-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="calc-step-body">{children}</div>}
    </div>
  );
};

interface BlockFilterProps {
  aboveBlock: CalcSteps['aboveBlock'];
  belowBlock: CalcSteps['belowBlock'];
  sumVotes: number;
  blockThreshold: number;
  blockPercentage: number;
  getPartyName: (party: string) => string;
}

const Step1BlockFilter: React.FC<BlockFilterProps> = ({
  aboveBlock,
  belowBlock,
  sumVotes,
  blockThreshold,
  blockPercentage,
  getPartyName,
}) => (
  <div>
    <p className="calc-step-desc">
      אחוז חסימה: <strong>{pctFmt.format(blockPercentage * 100)}%</strong> ← מינימום קולות:{' '}
      <strong>{numberFormat.format(blockThreshold)}</strong> מתוך{' '}
      {numberFormat.format(sumVotes)} קולות כשרים
    </p>
    <table className="calc-table">
      <thead>
        <tr>
          <th>מפלגה</th>
          <th>קולות</th>
          <th>אחוז</th>
          <th>תוצאה</th>
        </tr>
      </thead>
      <tbody>
        {aboveBlock.map((p) => (
          <tr key={p.party} className="calc-row-pass">
            <td>{getPartyName(p.party)}</td>
            <td>{numberFormat.format(p.votes)}</td>
            <td>{pctFmt.format(p.pct)}%</td>
            <td>
              <span className="calc-tag calc-tag-pass">עברה ✓</span>
            </td>
          </tr>
        ))}
        {belowBlock.map((p) => (
          <tr key={p.party} className="calc-row-fail">
            <td>{getPartyName(p.party)}</td>
            <td>{numberFormat.format(p.votes)}</td>
            <td>{pctFmt.format(p.pct)}%</td>
            <td>
              <span className="calc-tag calc-tag-fail">לא עברה ✗</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

interface Step2Props {
  participatingVotes: number;
  votesPerMandat: number;
  totalMandats: number;
}

const Step2ModedLeMandat: React.FC<Step2Props> = ({
  participatingVotes,
  votesPerMandat,
  totalMandats,
}) => (
  <div>
    <p className="calc-step-desc">
      מחשבים: קולות כשרים של מפלגות שעברו ÷ {totalMandats} מנדטים
    </p>
    <div className="calc-formula-row">
      <span className="calc-formula-num">
        {numberFormat.format(Math.round(participatingVotes))}
      </span>
      <span className="calc-formula-op">÷</span>
      <span className="calc-formula-num">{totalMandats}</span>
      <span className="calc-formula-op">=</span>
      <span className="calc-formula-result">{ratioFmt.format(votesPerMandat)}</span>
      <span className="calc-formula-label">קולות למנדט</span>
    </div>
  </div>
);

interface Step3Props {
  wholeMandatesRows: CalcSteps['wholeMandatesRows'];
  totalWhole: number;
  remainingMandats: number;
  getPartyName: (party: string) => string;
}

const Step3WholeMandates: React.FC<Step3Props> = ({
  wholeMandatesRows,
  totalWhole,
  remainingMandats,
  getPartyName,
}) => (
  <div>
    <p className="calc-step-desc">
      לכל מפלגה: <code>קולות ÷ מודד = מנדטים שלמים (ללא שארית)</code>. סה״כ מנדטים שלמים:{' '}
      <strong>{totalWhole}</strong>, נותרו לחלוקה: <strong>{remainingMandats}</strong>
    </p>
    <table className="calc-table">
      <thead>
        <tr>
          <th>מפלגה</th>
          <th>קולות</th>
          <th>מנדטים שלמים</th>
          <th>שארית קולות</th>
        </tr>
      </thead>
      <tbody>
        {wholeMandatesRows.map((p) => (
          <tr key={p.party}>
            <td>{getPartyName(p.party)}</td>
            <td>{numberFormat.format(p.votes)}</td>
            <td>{p.wholeMandats}</td>
            <td>{numberFormat.format(Math.round(p.remainder))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

interface AgreementsProps {
  agreementsInfo: CalcSteps['agreementsInfo'];
  getPartyName: (party: string) => string;
}

const Step4Agreements: React.FC<AgreementsProps> = ({
  agreementsInfo,
  getPartyName,
}) => {
  if (agreementsInfo.length === 0) {
    return (
      <p className="calc-step-desc calc-empty">
        אין הסכמי עודפים בבחירות אלו.
      </p>
    );
  }
  const valid = agreementsInfo.filter((a) => a.valid);
  const invalid = agreementsInfo.filter((a) => !a.valid);

  return (
    <div>
      {valid.length > 0 && (
        <>
          <p className="calc-step-desc">
            קולות המפלגות בכל הסכם מצטרפים לחישוב המנדטים המשותף:
          </p>
          <table className="calc-table">
            <thead>
              <tr>
                <th>מפלגה א׳</th>
                <th>מפלגה ב׳</th>
                <th>קולות משותפים</th>
                <th>מנדטים שלמים משותפים</th>
              </tr>
            </thead>
            <tbody>
              {valid.map(({ parties: [a, b], votes, wholeMandats }) => (
                <tr key={`${a}-${b}`}>
                  <td>{getPartyName(a)}</td>
                  <td>{getPartyName(b)}</td>
                  <td>{votes != null ? numberFormat.format(votes) : '—'}</td>
                  <td>{wholeMandats ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {invalid.length > 0 && (
        <>
          <p className="calc-step-desc" style={{ marginTop: valid.length > 0 ? 16 : 0 }}>
            ❌ הסכמים שלא נכנסו לתוקף (מפלגה אחת או יותר לא עברה את אחוז החסימה):
          </p>
          <table className="calc-table">
            <thead>
              <tr>
                <th>מפלגה א׳</th>
                <th>מפלגה ב׳</th>
                <th>סיבת הביטול</th>
              </tr>
            </thead>
            <tbody>
              {invalid.map(({ parties: [a, b], invalidParties }) => (
                <tr key={`${a}-${b}`} className="calc-row-fail">
                  <td>{getPartyName(a)}</td>
                  <td>{getPartyName(b)}</td>
                  <td>
                    {invalidParties.map((p) => getPartyName(p)).join(', ')}{' '}
                    {invalidParties.length === 1 ? 'לא עברה' : 'לא עברו'} את אחוז החסימה
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

interface Step5Props {
  remainderRounds: CalcSteps['remainderRounds'];
  algorithmUsed: CalcSteps['algorithmUsed'];
  remainingMandats: number;
  getPartyName: (party: string) => string;
}

const Step5RemainderRounds: React.FC<Step5Props> = ({
  remainderRounds,
  algorithmUsed,
  remainingMandats,
  getPartyName,
}) => {
  if (algorithmUsed === 'baderOffer') {
    return (
      <div>
        <p className="calc-step-desc">
          שיטת <strong>בדר–עופר</strong>: בכל סיבוב מחולק המנדט הנוסף למפלגה/הסכם עם
          היחס הגבוה ביותר (קולות ÷ (מנדטים+1)). חוזרים {remainingMandats} פעמים.
          בכל סיבוב מוצג היחס של כל המועמדים; הזוכה (היחס הגבוה ביותר) מודגש בטבלה.
        </p>
        <table className="calc-table">
          <thead>
            <tr>
              <th>מפלגה</th>
              <th>קולות</th>
              <th>מנדטים נוכחיים</th>
              <th>מכנה</th>
              <th>יחס</th>
            </tr>
          </thead>
          <tbody>
            {(remainderRounds as any[]).map((r) => (
              <React.Fragment key={`round-${r.round}`}>
                <tr className="calc-round-divider">
                  <td colSpan={5}>סיבוב {r.round}</td>
                </tr>
                {r.allCandidates.map((c: any) => (
                  <tr
                    key={`${r.round}-${c.party}`}
                    className={c.party === r.winner ? 'calc-row-pass' : ''}
                  >
                    <td>{getPartyName(c.party)}</td>
                    <td>{numberFormat.format(c.votes)}</td>
                    <td>{c.mandats}</td>
                    <td>{c.divisor}</td>
                    <td>{ratioFmt.format(c.ratio)}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <p className="calc-step-desc">
        שיטת <strong>עיגול כלפי מעלה</strong>: המפלגות ממוינות לפי שארית הקולות .
        {remainingMandats} הראשונות מקבלות מנדט עודף.
      </p>
      <table className="calc-table">
        <thead>
          <tr>
            <th>דירוג</th>
            <th>מפלגה</th>
            <th>קולות</th>
            <th>מנדטים שלמים</th>
            <th>שארית</th>
            <th>מנדט עודף?</th>
          </tr>
        </thead>
        <tbody>
          {(remainderRounds as any[]).map((r, i) => (
            <tr key={r.party} className={r.getsBonus ? 'calc-row-pass' : ''}>
              <td>{i + 1}</td>
              <td>{getPartyName(r.party)}</td>
              <td>{numberFormat.format(r.votes)}</td>
              <td>{r.wholeMandats}</td>
              <td>{ratioFmt.format(r.remainder)}</td>
              <td>
                {r.getsBonus ? (
                  <span className="calc-tag calc-tag-pass">
                    כן — שארית גבוהה מספיק ✓
                  </span>
                ) : (
                  <span style={{ color: 'var(--ink-50)' }}>לא — שארית נמוכה מדי</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface AgreementSplitDetailProps {
  split: AgreementSplit;
  getPartyName: (party: string) => string;
}

const AgreementSplitDetail: React.FC<AgreementSplitDetailProps> = ({
  split,
  getPartyName,
}) => {
  const {
    parties: [a, b],
    totalMandats,
    aWholeMandats = 0,
    bWholeMandats = 0,
    remainingAfterWhole = totalMandats,
    aVotes = 0,
    bVotes = 0,
    pairVotes = 0,
    agreementModed = 0,
    aResult,
    bResult,
    splitRounds,
    algorithmUsed,
  } = split;

  const aName = getPartyName(a);
  const bName = getPartyName(b);
  const totalVotes = pairVotes || aVotes + bVotes;

  const baseline = (
    <div className="calc-split-baseline">
      <div className="calc-split-baseline-row">
        <span className="calc-step-desc">מודד ההסכם:</span>
        <div className="calc-formula-row">
          <span className="calc-formula-num">
            {numberFormat.format(aVotes)} + {numberFormat.format(bVotes)}
          </span>
          <span className="calc-formula-op">=</span>
          <span className="calc-formula-num">
            {numberFormat.format(totalVotes)}
          </span>
        </div>
        <div className="calc-formula-row">
          <span className="calc-formula-num">
            {numberFormat.format(totalVotes)}
          </span>
          <span className="calc-formula-op">÷</span>
          <span className="calc-formula-num">{totalMandats}</span>
          <span className="calc-formula-op">=</span>
          <span className="calc-formula-num">
            {ratioFmt.format(agreementModed || 0)}
          </span>
          <span className="calc-formula-label">קולות למנדט (מודד ההסכם)</span>
        </div>
      </div>
      <div className="calc-split-baseline-row">
        <span className="calc-step-desc">{aName}:</span>
        <div className="calc-formula-row">
          <span className="calc-formula-num">{numberFormat.format(aVotes)}</span>
          <span className="calc-formula-op">÷</span>
          <span className="calc-formula-num">
            {ratioFmt.format(agreementModed || 0)}
          </span>
          <span className="calc-formula-op">≈</span>
          <span className="calc-formula-num">{aWholeMandats}</span>
          <span className="calc-formula-label">מנדטים שלמים</span>
        </div>
      </div>
      <div className="calc-split-baseline-row">
        <span className="calc-step-desc">{bName}:</span>
        <div className="calc-formula-row">
          <span className="calc-formula-num">{numberFormat.format(bVotes)}</span>
          <span className="calc-formula-op">÷</span>
          <span className="calc-formula-num">
            {ratioFmt.format(agreementModed || 0)}
          </span>
          <span className="calc-formula-op">≈</span>
          <span className="calc-formula-num">{bWholeMandats}</span>
          <span className="calc-formula-label">מנדטים שלמים</span>
        </div>
      </div>
      <div className="calc-split-baseline-remaining">
        נותרים לחלוקה: <strong>{remainingAfterWhole}</strong>{' '}
        {remainingAfterWhole === 1 ? 'מנדט' : 'מנדטים'} עודפים
      </div>
    </div>
  );

  if (algorithmUsed === 'baderOffer') {
    return (
      <div className="calc-agreement-split">
        <div className="calc-agreement-split-title">
          {aName} + {bName} — סה″כ <strong>{totalMandats}</strong> מנדטים
        </div>
        {baseline}
        {remainingAfterWhole > 0 && (
          <>
            <p className="calc-step-desc" style={{ marginTop: 8 }}>
              שיטת <strong>בדר–עופר</strong> לחלוקת {remainingAfterWhole}{' '}
              {remainingAfterWhole === 1 ? 'מנדט' : 'מנדטים'} עודפים בין המפלגות
              בהסכם.
            </p>
            <table className="calc-table">
              <thead>
                <tr>
                  <th>מפלגה</th>
                  <th>קולות</th>
                  <th>מנדטים נוכחיים</th>
                  <th>מכנה</th>
                  <th>יחס</th>
                </tr>
              </thead>
              <tbody>
                {(splitRounds as any[]).map((r) => (
                  <React.Fragment key={`split-round-${r.round}`}>
                    <tr className="calc-round-divider">
                      <td colSpan={5}>סיבוב {r.round}</td>
                    </tr>
                    {r.allCandidates.map((c: any) => (
                      <tr
                        key={`${r.round}-${c.party}`}
                        className={c.party === r.winner ? 'calc-row-pass' : ''}
                      >
                        <td>{getPartyName(c.party)}</td>
                        <td>{numberFormat.format(c.votes)}</td>
                        <td>{c.mandats}</td>
                        <td>{c.divisor}</td>
                        <td>{ratioFmt.format(c.ratio)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </>
        )}
        <div className="calc-split-summary">
          סיכום: {aName} — <strong>{aResult?.mandats ?? 0}</strong> מנדטים, {bName} —{' '}
          <strong>{bResult?.mandats ?? 0}</strong> מנדטים
        </div>
      </div>
    );
  }

  return (
    <div className="calc-agreement-split">
      <div className="calc-agreement-split-title">
        {aName} + {bName} — סה″כ <strong>{totalMandats}</strong> מנדטים
      </div>
      {baseline}
      <table className="calc-table" style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th>דירוג</th>
            <th>מפלגה</th>
            <th>קולות</th>
            <th>מנדטים שלמים</th>
            <th>שארית</th>
            <th>מנדט עודף?</th>
          </tr>
        </thead>
        <tbody>
          {(splitRounds as any[]).map((r, i) => (
            <tr key={r.party} className={r.getsBonus ? 'calc-row-pass' : ''}>
              <td>{i + 1}</td>
              <td>{getPartyName(r.party)}</td>
              <td>{numberFormat.format(r.votes)}</td>
              <td>{r.wholeMandats}</td>
              <td>{ratioFmt.format(r.remainder)}</td>
              <td>
                {r.getsBonus ? (
                  <span className="calc-tag calc-tag-pass">כן ✓</span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} className="calc-split-summary">
              סיכום: {aName} — <strong>{aResult?.mandats ?? 0}</strong>, {bName} —{' '}
              <strong>{bResult?.mandats ?? 0}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

interface Step6Props {
  agreementSplits: CalcSteps['agreementSplits'];
  getPartyName: (party: string) => string;
}

const Step6AgreementSplits: React.FC<Step6Props> = ({
  agreementSplits,
  getPartyName,
}) => {
  if (agreementSplits.length === 0) {
    return (
      <p className="calc-step-desc calc-empty">
        אין הסכמי עודפים תקפים לחלוקה.
      </p>
    );
  }
  return (
    <div>
      <p className="calc-step-desc">
        כל הסכם קיבל מכסת מנדטים — עכשיו מחלקים בין שתי המפלגות בהסכם:
      </p>
      {agreementSplits.map((split) => (
        <AgreementSplitDetail
          key={split.parties.join('-')}
          split={split}
          getPartyName={getPartyName}
        />
      ))}
    </div>
  );
};

interface Step7Props {
  finalResults: CalcSteps['finalResults'];
  totalMandats: number;
  getPartyName: (party: string) => string;
}

const Step7FinalResults: React.FC<Step7Props> = ({
  finalResults,
  totalMandats,
  getPartyName,
}) => {
  const totalCheck = finalResults.reduce((s, p) => s + p.total, 0);
  return (
    <div>
      <p className="calc-step-desc">
        סה״כ {totalCheck} מנדטים חולקו מתוך {totalMandats}. עמודת «שלמים» = מנדטים
        שלמים, «עודפים» = מנדטים שהתקבלו מחלוקת השאריות:
      </p>
      <table className="calc-table">
        <thead>
          <tr>
            <th>מפלגה</th>
            <th>שלמים</th>
            <th>עודפים</th>
            <th>סה״כ</th>
          </tr>
        </thead>
        <tbody>
          {finalResults.map((p) => (
            <tr key={p.party}>
              <td>{getPartyName(p.party)}</td>
              <td>
                {p.wholeMandats > 0 ? (
                  <span className="calc-tag calc-tag-whole">{p.wholeMandats}</span>
                ) : (
                  '—'
                )}
              </td>
              <td>
                {p.remainderMandats > 0 ? (
                  <span className="calc-tag calc-tag-remainder">
                    {p.remainderMandats}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td>
                <strong>{p.total}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface CalcDetailsCardProps {
  voteData: VoteData;
  activeConfig: { blockPercentage: number; agreements?: [string, string][]; algorithm: string };
  getPartyName: (party: string) => string;
}

const CalcDetailsCard: React.FC<CalcDetailsCardProps> = ({
  voteData,
  activeConfig,
  getPartyName,
}) => {
  const cleanVoteData: VoteData = Object.fromEntries(
    Object.entries(voteData).filter(
      ([party, data]) => !NON_PARTY_KEYS.has(party) && (data?.votes ?? 0) > 0,
    ),
  ) as VoteData;

  if (Object.keys(cleanVoteData).length === 0) return null;

  const steps = buildCalcSteps(
    Object.fromEntries(
      Object.entries(cleanVoteData).map(([party, data]) => [
        party,
        { votes: data.votes, mandats: 0 },
      ]),
    ),
    {
      blockPercentage: activeConfig.blockPercentage,
      agreements: activeConfig.agreements ?? [],
      algorithm: activeConfig.algorithm as 'baderOffer' | 'ceilRound',
    },
  );

  const resolvePartyName = (key: string): string => {
    if (key.includes('+')) return key.split('+').map(getPartyName).join(' + ');
    return getPartyName(key);
  };

  const validAgreements = steps.agreementsInfo.filter((a) => a.valid).length;
  const invalidAgreements = steps.agreementsInfo.filter((a) => !a.valid).length;
  const agreementBadge =
    steps.agreementsInfo.length === 0
      ? 'אין'
      : `${validAgreements} תקפים${
          invalidAgreements > 0 ? ` | ${invalidAgreements} בוטלו` : ''
        }`;

  return (
    <section className="calc-details-panel panel">
      <h2>חישוב מנדטים — שלב אחר שלב</h2>

      <StepSection
        number={1}
        title="סינון אחוז חסימה"
        badge={`${steps.aboveBlock.length} עברו | ${steps.belowBlock.length} נפלו`}
      >
        <Step1BlockFilter
          aboveBlock={steps.aboveBlock}
          belowBlock={steps.belowBlock}
          sumVotes={steps.sumVotes}
          blockThreshold={steps.blockThreshold}
          blockPercentage={steps.blockPercentage}
          getPartyName={getPartyName}
        />
      </StepSection>

      <StepSection
        number={2}
        title="מודד למנדט"
        badge={`${numberFormat.format(Math.round(steps.votesPerMandat))} קולות`}
      >
        <Step2ModedLeMandat
          participatingVotes={steps.participatingVotes}
          votesPerMandat={steps.votesPerMandat}
          totalMandats={steps.totalMandats}
        />
      </StepSection>

      <StepSection
        number={3}
        title="מנדטים שלמים"
        badge={`${steps.totalWhole} שלמים, ${steps.remainingMandats} לחלוקה`}
      >
        <Step3WholeMandates
          wholeMandatesRows={steps.wholeMandatesRows}
          totalWhole={steps.totalWhole}
          remainingMandats={steps.remainingMandats}
          getPartyName={getPartyName}
        />
      </StepSection>

      <StepSection
        number={4}
        title="הסכמי עודפים"
        badge={agreementBadge}
      >
        <Step4Agreements
          agreementsInfo={steps.agreementsInfo}
          getPartyName={getPartyName}
        />
      </StepSection>

      <StepSection
        number={5}
        title="חלוקת מנדטים עודפים"
        badge={
          steps.algorithmUsed === 'baderOffer'
            ? 'בדר–עופר'
            : 'עיגול כלפי מעלה'
        }
      >
        <Step5RemainderRounds
          remainderRounds={steps.remainderRounds}
          algorithmUsed={steps.algorithmUsed}
          remainingMandats={steps.remainingMandats}
          getPartyName={resolvePartyName}
        />
      </StepSection>

      <StepSection
        number={6}
        title="חלוקה בתוך הסכמים"
        badge={`${steps.agreementSplits.length} הסכמים`}
      >
        <Step6AgreementSplits
          agreementSplits={steps.agreementSplits}
          getPartyName={getPartyName}
        />
      </StepSection>

      <StepSection
        number={7}
        title="תוצאות סופיות"
        badge={`${steps.totalMandats} מנדטים`}
      >
        <Step7FinalResults
          finalResults={steps.finalResults}
          totalMandats={steps.totalMandats}
          getPartyName={getPartyName}
        />
      </StepSection>
    </section>
  );
};

export default CalcDetailsCard;

