import { hasLocalityData, hasEmbeddedPollingStations, pollingStationSource } from '../lib/locality-availability';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppHeader from './AppHeader';
import { useElectionData } from '../hooks/use-election-data';
import { parseLocalities, parsePollingStations, rankLocalities, type LocalityVotes } from '../lib/party-research';

export default function PartyResearch() {
  const { electionId = '' } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const { availableElections, partyNames, electionManifest } = useElectionData(electionId, false);
  const [data, setData] = useState<LocalityVotes[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [minimum, setMinimum] = useState(0);
  const [limits, setLimits] = useState({ votes: 20, percentage: 20 });
  const [updated, setUpdated] = useState<string | null>(null);
  const supported = hasLocalityData(electionId);
  const counting = electionManifest?.phase === 'counting';
  const [stationAvailability, setStationAvailability] = useState({ election: '', available: false });
  const embeddedStations = hasEmbeddedPollingStations(electionId);
  const stationSource = pollingStationSource(electionId);
  const stationsAvailable = embeddedStations || (stationAvailability.election === electionId && stationAvailability.available);
  const byStation = search.get('level') === 'stations' && stationsAvailable;
  const plural = byStation ? 'קלפיות' : 'יישובים';
  const singular = byStation ? 'קלפי' : 'יישוב';

  useEffect(() => { setMinimum(0); setLimits({ votes: 20, percentage: 20 }); }, [electionId, byStation]);

  useEffect(() => {
    if (!stationSource || embeddedStations) return;
    const controller = new AbortController();
    let inFlight = false;
    const check = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(stationSource, { method: 'HEAD', cache: 'no-store', signal: controller.signal });
        if (!controller.signal.aborted) setStationAvailability(previous => ({
          election: electionId,
          // Keep the option on transient refresh errors once this election's file was found.
          available: (response.ok && !!response.headers.get('content-type')?.includes('csv')) || (previous.election === electionId && previous.available),
        }));
      } catch { /* The locality view remains usable when the optional file is absent. */ }
      finally { inFlight = false; }
    };
    void check();
    const interval = counting ? window.setInterval(() => {
      if (document.visibilityState === 'visible') void check();
    }, 30_000) : undefined;
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [electionId, stationSource, embeddedStations, counting, attempt]);

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
        const response = await fetch(byStation ? stationSource! : `/data/${electionId}/elections.csv`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('CSV unavailable');
        const parsed = (byStation ? parsePollingStations : parseLocalities)(await response.text());
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
  }, [electionId, supported, counting, attempt, byStation, stationSource]);

  const parties = useMemo(() => {
    const totals = new Map<string, number>();
    for (const locality of data ?? []) for (const [party, votes] of Object.entries(locality.votes)) totals.set(party, (totals.get(party) ?? 0) + votes);
    return [...totals].sort((a, b) => b[1] - a[1]).map(([party]) => party);
  }, [data]);
  const requested = search.get('party');
  const party = requested && parties.includes(requested) ? requested : parties[0] ?? '';
  const effectiveMinimum = byStation ? 0 : minimum;
  const byVotes = useMemo(() => rankLocalities(data ?? [], party, 'votes', effectiveMinimum), [data, party, effectiveMinimum]);
  const byPercentage = useMemo(() => rankLocalities(data ?? [], party, 'percentage', effectiveMinimum), [data, party, effectiveMinimum]);
  const name = (key: string) => partyNames[key] || electionManifest?.lists.find(list => list.ballotLetter === key)?.name || key;
  return <div className="screen party-research">
    <AppHeader statusText={`מחקר תוצאות לפי ${singular}`} showSimulator isEdited={false}
      currentElection={electionId} setCurrentElection={id => { setMinimum(0); setLimits({ votes: 20, percentage: 20 }); navigate(`/${hasLocalityData(id) ? 'research' : 'results'}/${id}`); }}
      availableElections={availableElections} viewMode="research"
      setViewMode={mode => navigate(mode === 'summary' ? '/summary' : `/${mode}/${electionId}`)} />
    <main className="panel">
      <h1>מחקר מפלגות</h1>
      {!supported ? <p>נתוני יישובים אינם זמינים לבחירות אלו.</p> : <>
        {stationsAvailable && <div className="research-level-switcher" role="group" aria-label="יחידת המחקר">
          {(['localities', 'stations'] as const).map(level => <button key={level} type="button" className={`ghost${byStation === (level === 'stations') ? ' active' : ''}`}
            aria-pressed={byStation === (level === 'stations')} onClick={() => {
              const next = new URLSearchParams(search);
              if (level === 'stations') next.set('level', level); else next.delete('level');
              setSearch(next); setMinimum(0); setLimits({ votes: 20, percentage: 20 });
            }}>{level === 'stations' ? 'לפי קלפיות' : 'לפי יישובים'}</button>)}
        </div>}
        <p>בחרו רשימה כדי לגלות באילו {plural} קיבלה את התמיכה הגבוהה ביותר.</p>
        {counting && <p className="research-notice">הספירה נמשכת: הדירוג מבוסס על הקולות שפורסמו עד כה, ועשוי להשתנות. הנתונים מתרעננים אוטומטית.</p>}
        <p>האחוז מחושב מתוך הקולות הכשרים בכל {singular}. מעטפות כפולות וקולות שאינם משויכים ליישוב אינם נכללים.</p>
        {electionManifest && electionManifest.phase !== 'final' && updated && <p>קובץ נתוני ה{plural} עודכן: {new Date(updated).toLocaleString('he-IL')}</p>}
        {error && <p role="alert">טעינת נתוני ה{plural} נכשלה.{data ? ' מוצגים הנתונים האחרונים שהתקבלו.' : ''} <button type="button" className="ghost" onClick={() => setAttempt(value => value + 1)}>ניסיון נוסף</button></p>}
        {!data && !error && <p role="status">טוען נתוני {plural}...</p>}
        {data && !parties.length && <p>טרם פורסמו תוצאות לפי {singular}.</p>}
        {!!parties.length && <>
          <div className="research-controls">
            <label>רשימה<select value={party} onChange={event => { const next = new URLSearchParams(search); next.set('party', event.target.value); setSearch(next); setLimits({ votes: 20, percentage: 20 }); }}>
              {parties.map(key => <option key={key} value={key}>{name(key)} ({key})</option>)}
            </select></label>
            {!byStation && <label>מינימום קולות כשרים ביישוב<input type="number" min="0" step="1" value={minimum} onChange={event => { setMinimum(Math.max(0, Math.floor(Number(event.target.value) || 0))); setLimits({ votes: 20, percentage: 20 }); }} /></label>}
          </div>
          <h2>{name(party)}</h2>
          <p>{byVotes.length.toLocaleString('he-IL')} {plural} שבה{byStation ? 'ן' : 'ם'} התקבלו קולות לרשימה ועומד{byStation ? 'ות' : 'ים'} בסינון</p>
          <div className="research-rankings">
            {(['votes', 'percentage'] as const).map(order => <section key={order}>
              <h3>{order === 'votes' ? 'הכי הרבה קולות' : 'אחוז התמיכה הגבוה ביותר'}</h3>
              <table><thead><tr><th scope="col">דירוג</th><th scope="col">יישוב</th>{byStation && <th scope="col">קלפי</th>}<th scope="col">קולות</th><th scope="col">אחוז</th></tr></thead>
                <tbody>{(order === 'votes' ? byVotes : byPercentage).slice(0, limits[order]).map((row, index) => <tr key={row.id}>
                  <td>{index + 1}</td><th scope="row">{row.name}</th>{byStation && <td>{row.pollingStation}{!!row.split && ` (פיצול ${row.split})`}</td>}<td>{row.partyVotes.toLocaleString('he-IL')}</td><td>{row.percentage.toLocaleString('he-IL', { maximumFractionDigits: 2 })}%</td>
                </tr>)}</tbody></table>
              {limits[order] < byVotes.length && <button type="button" className="ghost research-show-more"
                aria-label={`הצגת ${plural} נוספ${byStation ? 'ות' : 'ים'} לפי ${order === 'votes' ? 'מספר קולות' : 'אחוז התמיכה'}`}
                onClick={() => setLimits(previous => ({ ...previous, [order]: previous[order] + 50 }))}>הצגת {plural} נוספ{byStation ? 'ות' : 'ים'}</button>}
            </section>)}
          </div>
          {!byStation && !byVotes.length && <p>אין יישובים התואמים לסינון.</p>}
        </>}
      </>}
    </main>
  </div>;
}
