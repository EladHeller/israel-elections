import React from 'react';
import type { ElectionManifest } from '../types';

interface PreElectionViewProps {
  electionId: string;
  manifest: ElectionManifest;
}

const formatElectionDate = (date: string): string =>
  new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'long',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(date));

const PreElectionView: React.FC<PreElectionViewProps> = ({ electionId, manifest }) => {
  const hasLists = manifest.lists.length > 0;

  return (
    <main className="pre-election-view">
      <section className="panel pre-election-intro">
        <div className="pre-election-kicker">הבחירות הקרובות</div>
        <h2>הבחירות לכנסת ה־{electionId}</h2>
        {manifest.electionDate && (
          <div className="pre-election-date">
            יום הבחירות: {formatElectionDate(manifest.electionDate)}
          </div>
        )}
        {manifest.phase === 'beforeLists' && (
          <p>
            הרשימות עדיין לא נסגרו. לאחר פרסום הרשימות המתמודדות יוצגו כאן
            שמות הרשימות והאותיות שלהן, עוד לפני שיתקבלו תוצאות ראשונות.
          </p>
        )}
        {manifest.phase === 'listsFinal' && (
          <p>אלו הרשימות המתמודדות בבחירות, לפי המידע שפורסם לאחר סגירת הרשימות.</p>
        )}
        {manifest.phase === 'voting' && (
          <p>הקלפיות פתוחות. תוצאות רשמיות יוצגו כאן כאשר תתחיל ספירת הקולות.</p>
        )}
      </section>

      {hasLists && (
        <section className="panel election-lists-panel">
          <h2>הרשימות המתמודדות</h2>
          <div className="election-lists-grid">
            {manifest.lists.map((list) => (
              <article className="election-list-card" key={list.ballotLetter}>
                <div className="ballot-letter" aria-label={`אות ${list.ballotLetter}`}>
                  {list.ballotLetter}
                </div>
                <div>
                  <h3>{list.name}</h3>
                  {list.officialName && list.officialName !== list.name && (
                    <p>{list.officialName}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
};

export default PreElectionView;
