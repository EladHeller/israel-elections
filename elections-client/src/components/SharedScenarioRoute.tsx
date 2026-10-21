import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadSharedScenario } from '../lib/scenario-share-api';
import { decodeSharedScenario, type SharedScenario } from '../lib/shared-scenario';

function ScenarioLoading({ snapshot, error, fallback, children }: {
  snapshot: SharedScenario | null;
  error: boolean;
  fallback: string;
  children: (snapshot: SharedScenario) => React.ReactNode;
}) {
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
  const [snapshot, setSnapshot] = useState<SharedScenario | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setError(false);
    loadSharedScenario(id).then(value => {
      if (!cancelled) setSnapshot(value);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [id]);
  return <ScenarioLoading snapshot={snapshot} error={error} fallback="/" children={children} />;
}

export default function SharedScenarioRoute({ token, election, children }: {
  token: string; election: string; children: (snapshot: SharedScenario) => React.ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<SharedScenario | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = token.startsWith('s-')
      ? loadSharedScenario(token.slice(2)).then(value => {
        if (value.election !== election) throw new Error('Election mismatch');
        return value;
      })
      : decodeSharedScenario(token, election);
    load.then(value => {
      if (!cancelled) setSnapshot(value);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [token, election]);
  return <ScenarioLoading snapshot={snapshot} error={error} fallback={`/simulator/${election}`} children={children} />;
}
