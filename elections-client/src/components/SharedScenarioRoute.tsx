import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { decodeSharedScenario, type SharedScenario } from '../lib/shared-scenario';

export default function SharedScenarioRoute({ token, election, children }: {
  token: string; election: string; children: (snapshot: SharedScenario) => React.ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<SharedScenario | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    decodeSharedScenario(token, election).then(value => {
      if (!cancelled) setSnapshot(value);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [token, election]);
  if (error) return <main className="screen error">
    <h1>לא ניתן לפתוח את התרחיש</h1><p>הקישור פגום או שגרסת התרחיש אינה נתמכת.</p>
    <Link to={`/simulator/${election}`}>פתיחת סימולטור חדש</Link>
  </main>;
  if (!snapshot) return <main className="screen loading"><h1>טוען תרחיש…</h1></main>;
  return children(snapshot);
}
