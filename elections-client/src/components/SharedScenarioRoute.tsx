import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadSharedScenario } from '../lib/scenario-share-api';
import { decodeSharedScenario, type SharedScenario } from '../lib/shared-scenario';

function SharedScenarioLoader({ load, fallback, children }: {
  load: () => Promise<SharedScenario>;
  fallback: string;
  children: (snapshot: SharedScenario) => React.ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<SharedScenario | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setError(false);
    load().then(value => {
      if (!cancelled) setSnapshot(value);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [load]);
  if (error) return <main className="screen error">
    <h1>לא ניתן לפתוח את התרחיש</h1><p>הקישור פגום או שגרסת התרחיש אינה נתמכת.</p>
    <Link to={fallback}>פתיחת סימולטור חדש</Link>
  </main>;
  if (!snapshot) return <main className="screen loading"><h1>טוען תרחיש…</h1></main>;
  return children(snapshot);
}

export function ShortSharedScenarioRoute({ id, children }: {
  id: string; children: (snapshot: SharedScenario) => React.ReactNode;
}) {
  return <SharedScenarioLoader key={id} load={() => loadSharedScenario(id)} fallback="/">
    {children}
  </SharedScenarioLoader>;
}

export default function SharedScenarioRoute({ token, election, children }: {
  token: string; election: string; children: (snapshot: SharedScenario) => React.ReactNode;
}) {
  return <SharedScenarioLoader key={`${election}:${token}`} load={() => decodeSharedScenario(token, election)}
    fallback={`/simulator/${election}`}>
    {children}
  </SharedScenarioLoader>;
}
