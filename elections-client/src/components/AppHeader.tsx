import React from 'react';
import type { AppViewMode } from '../types';
import ElectionSelector from './ElectionSelector';

interface AppHeaderProps {
  statusText: string;
  showViewControl: boolean;
  isEdited: boolean;
  currentElection: string | null;
  setCurrentElection: (id: string) => void;
  availableElections: string[];
  viewMode: AppViewMode;
  setViewMode: (mode: AppViewMode) => void;
}

const VIEW_OPTIONS: { value: AppViewMode; label: string }[] = [
  { value: 'results', label: 'תוצאות' },
  { value: 'simulator', label: 'סימולטור' },
  { value: 'summary', label: 'כל הכנסות' },
];

const AppHeader: React.FC<AppHeaderProps> = ({
  statusText,
  showViewControl,
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
        {statusText}
        {isEdited && <span className="edited-tag">נתונים נערכו</span>}
      </div>
    </div>
    <div className="controls">
      {showViewControl && (
        <div className="view-control">
          <span>תצוגה</span>
          <div className="view-switcher" role="group" aria-label="בחירת תצוגה">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={viewMode === option.value ? 'is-active' : ''}
                aria-pressed={viewMode === option.value}
                onClick={() => setViewMode(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <ElectionSelector
        value={currentElection}
        elections={availableElections}
        onChange={setCurrentElection}
        disabled={showViewControl && viewMode === 'summary'}
      />
    </div>
  </header>
);

export default AppHeader;
