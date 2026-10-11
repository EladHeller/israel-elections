import React from 'react';
import type { ElectionConfig, ElectionManifest } from '../types';
import PartyRow from './PartyRow';
import SummarySection from './SummarySection';

interface PreElectionViewProps {
  manifest: ElectionManifest;
  electionConfig: ElectionConfig;
}

const formatElectionDate = (date: string): string =>
  new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'long',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(date));

const PreElectionView: React.FC<PreElectionViewProps> = ({ manifest, electionConfig }) => (
  <main>
    <SummarySection
      editable={false}
      sumVotes={null}
      blockThreshold={null}
      activeConfig={electionConfig}
    />

    <section className="grid grid-single">
      <div className="panel">
        <div className="panel-head">
          <h2>מפלגות</h2>
          {manifest.electionDate && (
            <span className="election-date">
              יום הבחירות: {formatElectionDate(manifest.electionDate)}
            </span>
          )}
        </div>
        <p className="election-pending-note">
          {manifest.phase === 'beforeLists'
            ? 'הרשימות המתמודדות יופיעו כאן לאחר פרסומן.'
            : manifest.phase === 'voting'
              ? 'הקלפיות פתוחות. ממתינים לתוצאות ראשונות.'
              : 'טרם פורסמו תוצאות.'}
        </p>
        <div className="party-bars">
          {manifest.lists.map((list) => (
            <PartyRow
              key={list.ballotLetter}
              name={list.name}
              ballotLetter={list.ballotLetter}
              seats={<span aria-label="מנדטים טרם פורסמו">—</span>}
              votes={<span className="party-vote-value" aria-label="קולות טרם פורסמו">—</span>}
            />
          ))}
        </div>
      </div>
    </section>
  </main>
);

export default PreElectionView;
