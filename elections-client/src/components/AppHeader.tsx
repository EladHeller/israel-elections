import React from 'react';
import { formatTime } from '../lib/ui-helpers';

interface AppHeaderProps {
  hasFinalResults: boolean;
  resultsTime?: string;
  isEdited: boolean;
  currentElection: string | null;
  setCurrentElection: (id: string) => void;
  availableElections: string[];
  viewMode: 'simulator' | 'summary';
  setViewMode: (mode: 'simulator' | 'summary') => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  hasFinalResults,
  resultsTime,
  isEdited,
  currentElection,
  setCurrentElection,
  availableElections,
  viewMode,
  setViewMode,
}) => (
  <header className="header">
    <div>
      <h1>תוצאות הבחירות לכנסת</h1>
      <div className="subtitle">
        {hasFinalResults ? 'תוצאות סופיות' : `מעודכן ל-${formatTime(resultsTime)}`}
        {isEdited && <span className="edited-tag">נתונים נערכו</span>}
      </div>
    </div>
    <div className="controls">
      <label>
        <span>תצוגה</span>
        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as 'simulator' | 'summary')}
        >
          <option value="simulator">סימולטור</option>
          <option value="summary">סיכום כל הכנסות</option>
        </select>
      </label>
      <label>
        <span>כנסת</span>
        <select
          value={currentElection ?? ''}
          onChange={(e) => setCurrentElection(e.target.value)}
          disabled={viewMode === 'summary'}
        >
          {availableElections.map((election) => (
            <option key={election} value={election}>
              {election}
            </option>
          ))}
        </select>
      </label>
    </div>
  </header>
);

export default AppHeader;

