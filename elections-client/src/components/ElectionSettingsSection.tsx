import React, { useEffect, useState } from 'react';
import { algorithmLabel, numberFormat } from '../lib/ui-helpers';
import type { ElectionConfig } from '../types';

interface ElectionSettingsSectionProps {
  editable: boolean;
  blockThreshold: number | null;
  baseBlockThreshold?: number;
  activeConfig: ElectionConfig;
  isEdited?: boolean;
  onBlockPercentageChange?: (value: string) => void;
  onAlgorithmChange?: (algorithm: ElectionConfig['algorithm']) => void;
}

const ElectionSettingsSection: React.FC<ElectionSettingsSectionProps> = ({
  editable,
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
    <section className="election-settings" aria-label="הגדרות חלוקת המנדטים">
      <div className="election-setting">
        <label htmlFor={editable ? 'block-percentage' : undefined}>אחוז חסימה:</label>
        {editable ? (
          <div className="block-percentage-editor">
            <input
              id="block-percentage"
              className="block-percentage-input"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={blockPercentageDraft}
              onChange={(e) => setBlockPercentageDraft(e.target.value)}
              onBlur={() => onBlockPercentageChange?.(blockPercentageDraft)}
            />
            <span className="block-percentage-suffix">%</span>
          </div>
        ) : (
          <strong>{(activeConfig.blockPercentage * 100).toFixed(2)}%</strong>
        )}
        {blockThreshold !== null && (
          <span><bdi>{numberFormat.format(blockThreshold)}</bdi> קולות</span>
        )}
        {isEdited && baseBlockThreshold !== undefined && (
          <span className="summary-caption">(בסיס: <bdi>{numberFormat.format(baseBlockThreshold)}</bdi>)</span>
        )}
      </div>
      <div className="election-setting">
        <label htmlFor={editable ? 'election-algorithm' : undefined}>שיטת חישוב:</label>
        {editable ? (
          <select
            id="election-algorithm"
            className="algorithm-select"
            value={activeConfig.algorithm}
            onChange={(e) => onAlgorithmChange?.(e.target.value as ElectionConfig['algorithm'])}
          >
            <option value="baderOffer">{algorithmLabel('baderOffer')}</option>
            <option value="ceilRound">{algorithmLabel('ceilRound')}</option>
          </select>
        ) : (
          <strong>{algorithmLabel(activeConfig.algorithm)}</strong>
        )}
      </div>
    </section>
  );
};

export default ElectionSettingsSection;
