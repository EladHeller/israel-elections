import React, { useEffect, useState } from 'react';
import { algorithmLabel, numberFormat } from '../lib/ui-helpers';
import type { ElectionConfig } from '../types';

interface SummarySectionProps {
  editable: boolean;
  sumVotes: number;
  baseSumVotes: number;
  blockThreshold: number;
  baseBlockThreshold: number;
  activeConfig: ElectionConfig;
  isEdited: boolean;
  onBlockPercentageChange: (value: string) => void;
  onAlgorithmChange: (algorithm: ElectionConfig['algorithm']) => void;
}

const SummarySection: React.FC<SummarySectionProps> = ({
  editable,
  sumVotes,
  baseSumVotes,
  blockThreshold,
  baseBlockThreshold,
  activeConfig,
  isEdited,
  onBlockPercentageChange,
  onAlgorithmChange,
}) => {
  const [blockPercentageDraft, setBlockPercentageDraft] = useState(
    String((activeConfig.blockPercentage * 100).toFixed(2)),
  );

  useEffect(() => {
    setBlockPercentageDraft(String((activeConfig.blockPercentage * 100).toFixed(2)));
  }, [activeConfig.blockPercentage]);

  return (
    <section className="summary">
    <div className="card">
      <div className="card-label">סה"כ קולות כשרים</div>
      <div className="card-value">{numberFormat.format(sumVotes)}</div>
      {isEdited && (
        <div className="card-sub">בסיס: {numberFormat.format(baseSumVotes)}</div>
      )}
    </div>
    <div className="card">
      <div className="card-label">אחוז חסימה</div>
      {editable ? (
        <div className="block-percentage-row">
          <label className="block-percentage-editor">
            <input
              className="block-percentage-input"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={blockPercentageDraft}
              onChange={(e) => setBlockPercentageDraft(e.target.value)}
              onBlur={() => onBlockPercentageChange(blockPercentageDraft)}
            />
            <span className="block-percentage-suffix">%</span>
          </label>
          <div className="block-threshold-value">
            ({numberFormat.format(blockThreshold)})
          </div>
        </div>
      ) : (
        <div className="card-value">
          {(activeConfig.blockPercentage * 100).toFixed(2)}%{' '}
          <span className="card-value-detail">
            ({numberFormat.format(blockThreshold)} קולות)
          </span>
        </div>
      )}
      {isEdited && (
        <div className="card-sub">
          בסיס: ({numberFormat.format(baseBlockThreshold)})
        </div>
      )}
    </div>
    <div className="card">
      <div className="card-label">שיטת חישוב</div>
      {editable ? (
        <select
          className="algorithm-select"
          value={activeConfig.algorithm}
          onChange={(e) => onAlgorithmChange(e.target.value as ElectionConfig['algorithm'])}
        >
          <option value="baderOffer">{algorithmLabel('baderOffer')}</option>
          <option value="ceilRound">{algorithmLabel('ceilRound')}</option>
        </select>
      ) : (
        <div className="card-value">{algorithmLabel(activeConfig.algorithm)}</div>
      )}
    </div>
  </section>
  );
};

export default SummarySection;
