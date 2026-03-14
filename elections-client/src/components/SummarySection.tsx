import React from 'react';
import { algorithmLabel, numberFormat } from '../lib/ui-helpers';
import type { ElectionConfig } from '../types';

interface SummarySectionProps {
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
  sumVotes,
  baseSumVotes,
  blockThreshold,
  baseBlockThreshold,
  activeConfig,
  isEdited,
  onBlockPercentageChange,
  onAlgorithmChange,
}) => (
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
      <div className="block-percentage-row">
        <label className="block-percentage-editor">
          <input
            className="block-percentage-input"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={Number((activeConfig.blockPercentage * 100).toFixed(2))}
            onChange={(e) => onBlockPercentageChange(e.target.value)}
          />
          <span className="block-percentage-suffix">%</span>
        </label>
        <div className="block-threshold-value">
          ({numberFormat.format(blockThreshold)})
        </div>
      </div>
      {isEdited && (
        <div className="card-sub">
          בסיס: ({numberFormat.format(baseBlockThreshold)})
        </div>
      )}
    </div>
    <div className="card">
      <div className="card-label">שיטת חישוב</div>
      <select
        className="algorithm-select"
        value={activeConfig.algorithm}
        onChange={(e) => onAlgorithmChange(e.target.value as ElectionConfig['algorithm'])}
      >
        <option value="baderOffer">{algorithmLabel('baderOffer')}</option>
        <option value="ceilRound">{algorithmLabel('ceilRound')}</option>
      </select>
    </div>
  </section>
);

export default SummarySection;

