import React from 'react';
import { formatTime } from '../lib/ui-helpers.js';

const AppHeader = ({
  hasFinalResults,
  resultsTime,
  isEdited,
  currentElection,
  setCurrentElection,
  availableElections,
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
        <span>כנסת</span>
        <select value={currentElection} onChange={(e) => setCurrentElection(e.target.value)}>
          {availableElections.map((election) => (
            <option key={election} value={election}>{election}</option>
          ))}
        </select>
      </label>
    </div>
  </header>
);

export default AppHeader;
