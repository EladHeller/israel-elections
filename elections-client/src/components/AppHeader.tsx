import React from 'react';
import { hasLocalityData } from '../lib/locality-availability';
import type { AppViewMode } from '../types';
import ElectionSelector from './ElectionSelector';
import ThemeToggle from './ThemeToggle';

interface AppHeaderProps {
  statusText: string;
  actions?: React.ReactNode;
  statusAction?: React.ReactNode;
  resultsOverview?: React.ReactNode;
  showSimulator: boolean;
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
  { value: 'research', label: 'מחקר מפלגות' },
  { value: 'summary', label: 'כל הכנסות' },
];

const AppHeader: React.FC<AppHeaderProps> = ({
  statusText,
  actions,
  statusAction,
  resultsOverview,
  showSimulator,
  isEdited,
  currentElection,
  setCurrentElection,
  availableElections,
  viewMode,
  setViewMode,
}) => (
  <header className={`header${resultsOverview ? ' header-dashboard' : ''}`}>
    <div className="header-context">
      <div className="subtitle">
        {statusText}
        {statusAction}
        {isEdited && <span className="edited-tag">נתונים נערכו</span>}
      </div>
    </div>
    <div className="controls">
      <ThemeToggle />
      <div className="view-control">
        <span>תצוגה</span>
        <div className="view-switcher" role="group" aria-label="בחירת תצוגה">
          {VIEW_OPTIONS
            .filter(option => option.value !== 'research' || hasLocalityData(currentElection))
            .filter((option) => showSimulator || option.value !== 'simulator')
            .map((option) => (
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
      {actions}
      <ElectionSelector
        value={currentElection}
        elections={availableElections}
        onChange={setCurrentElection}
        disabled={viewMode === 'summary'}
      />
    </div>
    {resultsOverview}
  </header>
);

export default AppHeader;
