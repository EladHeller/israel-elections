import { hasLocalityData } from '../lib/locality-availability';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppHeader from './AppHeader';
import { useElectionData } from '../hooks/use-election-data';
import { parseLocalities, rankLocalities, type LocalityVotes } from '../lib/party-research';

export default function PartyResearch() {
  const { electionId = '' } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const { availableElections, partyNames, electionManifest } = useElectionData(electionId, false);
  const [data, setData] = useState<LocalityVotes[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [minimum, setMinimum] = useState(0);
  const [limit, setLimit] = useState(20);
  const [updated, setUpdated] = useState<string | null>(null);
  const supported = hasLocalityData(electionId);
  const counting = electionManifest?.phase === 'counting';

  useEffect(() => {
    setData(null);
    setError(false);
    setUpdated(null);
    if (!supported) return;
    const controller = new AbortController();
    let inFlight = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/data/${electionId}/elections.csv`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('CSV unavailable');
        const parsed = parseLocalities(await response.text());
        if (controller.signal.aborted) return;
        setData(parsed);
        setError(false);
        const modified = response.headers.get('last-modified');
        setUpdated(modified && Number.isFinite(Date.parse(modified)) ? modified : null);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally { inFlight = false; }
    };
    void load();
    const interval = counting ? window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 30_000) : undefined;
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [electionId, supported, counting, attempt]);

  const parties = useMemo(() => {
    const totals = new Map<string, number>();
    for (const locality of data ?? []) for (const [party, votes] of Object.entries(locality.votes)) totals.set(party, (totals.get(party) ?? 0) + votes);
    return [...totals].sort((a, b) => b[1] - a[1]).map(([party]) => party);
  }, [data]);
  const requested = search.get('party');
  const party = requested && parties.includes(requested) ? requested : parties[0] ?? '';
  const byVotes = useMemo(() => rankLocalities(data ?? [], party, 'votes', minimum), [data, party, minimum]);
  const byPercentage = useMemo(() => rankLocalities(data ?? [], party, 'percentage', minimum), [data, party, minimum]);
  const name = (key: string) => partyNames[key] || electionManifest?.lists.find(list => list.ballotLetter === key)?.name || key;
  return <div className="screen party-research">
    <AppHeader statusText="מחקר תוצאות לפי יישוב" showSimulator isEdited={false}
      currentElection={electionId} setCurrentElection={id => { setLimit(20); navigate(`/${hasLocalityData(id) ? 'research' : 'results'}/${id}`); }}
      availableElections={availableElections} viewMode="research"
      setViewMode={mode => navigate(mode === 'summary' ? '/summary' : `/${mode}/${electionId}`)} />
    <main className="panel">
      <h1>מחקר מפלגות</h1>
      {!supported ? <p>נתוני יישובים אינם זמינים לבחירות אלו.</p> : <>
        <p>בחרו רשימה כדי לגלות באילו יישובים קיבלה את התמיכה הגבוהה ביותר.</p>
        {counting && <p className="research-notice">הספירה נמשכת: הדירוג מבוסס על הקולות שפורסמו עד כה, ועשוי להשתנות. הנתונים מתרעננים אוטומטית.</p>}
        <p>האחוז מחושב מתוך הקולות הכשרים בכל יישוב. מעטפות כפולות וקולות שאינם משויכים ליישוב אינם נכללים.</p>
        {updated && <p>קובץ נתוני היישובים עודכן: {new Date(updated).toLocaleString('he-IL')}</p>}
        {error && <p role="alert">טעינת נתוני היישובים נכשלה.{data ? ' מוצגים הנתונים האחרונים שהתקבלו.' : ''} <button type="button" onClick={() => setAttempt(value => value + 1)}>ניסיון נוסף</button></p>}
        {!data && !error && <p role="status">טוען נתוני יישובים...</p>}
        {data && !parties.length && <p>טרם פורסמו תוצאות לפי יישוב.</p>}
        {!!parties.length && <>
          <div className="research-controls">
            <label>רשימה<select value={party} onChange={event => { setSearch({ party: event.target.value }); setLimit(20); }}>
              {parties.map(key => <option key={key} value={key}>{name(key)} ({key})</option>)}
            </select></label>
            <label>מינימום קולות כשרים ביישוב<input type="number" min="0" step="1" value={minimum} onChange={event => { setMinimum(Math.max(0, Math.floor(Number(event.target.value) || 0))); setLimit(20); }} /></label>
          </div>
          <h2>{name(party)}</h2>
          <p>{byVotes.length.toLocaleString('he-IL')} יישובים שבהם התקבלו קולות לרשימה ועומדים בסינון</p>
          <div className="research-rankings">
            {(['votes', 'percentage'] as const).map(order => <section key={order}>
              <h3>{order === 'votes' ? 'הכי הרבה קולות' : 'אחוז התמיכה הגבוה ביותר'}</h3>
              <table><thead><tr><th scope="col">דירוג</th><th scope="col">יישוב</th><th scope="col">קולות</th><th scope="col">אחוז</th></tr></thead>
                <tbody>{(order === 'votes' ? byVotes : byPercentage).slice(0, limit).map((row, index) => <tr key={row.id}>
                  <td>{index + 1}</td><th scope="row">{row.name}</th><td>{row.partyVotes.toLocaleString('he-IL')}</td><td>{row.percentage.toLocaleString('he-IL', { maximumFractionDigits: 2 })}%</td>
                </tr>)}</tbody></table>
            </section>)}
          </div>
          {!byVotes.length && <p>אין יישובים התואמים לסינון.</p>}
          {limit < byVotes.length && <button type="button" onClick={() => setLimit(value => value + 50)}>הצגת יישובים נוספים</button>}
        </>}
      </>}
    </main>
  </div>;
}
