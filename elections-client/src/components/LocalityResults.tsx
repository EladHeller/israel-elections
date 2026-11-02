import React, { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppHeader from './AppHeader';
import SearchableSelect from './SearchableSelect';
import { useElectionData } from '../hooks/use-election-data';
import { useLocalityResults } from '../hooks/use-locality-results';
import { hasLocalityData } from '../lib/locality-availability';
import { localityHref, localityId, localResults, stationLabel } from '../lib/locality-results';
import { computeBlocTotals } from '../lib/analytics';
import blocConfigurations from '../data/blocs.json';

const format = (value: number) => value.toLocaleString('he-IL', { maximumFractionDigits: 2 });

export default function LocalityResults() {
  const { electionId = '' } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useSearchParams();
  const { availableElections, electionConfig, electionManifest, partyNames, blocs } = useElectionData(electionId, false);
  const counting = electionManifest?.phase === 'counting';
  const { data, error, retry } = useLocalityResults(electionId, counting);
  const selectedId = query.get('locality');
  const stationId = query.get('station');
  const locality = data?.localities.find(row => row.id === selectedId);
  const stations = useMemo(() => (data?.stations ?? []).filter(row => localityId(row) === selectedId)
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })), [data, selectedId]);
  const selected = stationId ? stations.find(row => row.id === stationId) : locality;
  const results = useMemo(() => selected ? localResults(selected, electionConfig) : {}, [selected, electionConfig]);
  const parties = useMemo(() => Object.entries(selected?.votes ?? {}).map(([party, votes]) => ({
    party, votes, mandats: results[party]?.mandats ?? 0,
  })).sort((a, b) => b.votes - a.votes || a.party.localeCompare(b.party, 'he')), [selected, results]);
  const options = useMemo(() => [...(data?.localities ?? [])]
    .sort((a, b) => a.name.localeCompare(b.name, 'he')), [data]);
  const partyName = (party: string) => partyNames[party] || electionManifest?.lists.find(list => list.ballotLetter === party)?.name || party;
  const blocTotals = computeBlocTotals(results, blocs);
  const unassignedSeats = parties.reduce((sum, row) => sum + row.mandats, 0)
    - Object.values(blocTotals).reduce((sum, seats) => sum + seats, 0);
  const blocKeys = Object.keys(blocs.blocks);
  const hasBlocs = Object.hasOwn(blocConfigurations, electionId);

  return <div className="screen locality-results">
    <AppHeader statusText="תוצאות לפי יישוב וקלפי" showSimulator isEdited={false}
      currentElection={electionId} availableElections={availableElections} viewMode="localities"
      setCurrentElection={id => { navigate(`/${hasLocalityData(id) ? 'localities' : 'results'}/${id}`); }}
      setViewMode={mode => navigate(mode === 'summary' ? '/summary' : `/${mode}/${electionId}`)} />
    <main>
      <section className="panel">
        <h1>יישובים</h1>
        {!hasLocalityData(electionId) ? <p>נתוני יישובים אינם זמינים לבחירות אלו.</p> : <>
          {error && <p role="alert">טעינת נתוני היישובים נכשלה.{data ? ' מוצגים הנתונים האחרונים שהתקבלו.' : ''} <button type="button" className="ghost" onClick={retry}>ניסיון נוסף</button></p>}
          {!data && !error && <p role="status">טוען נתוני יישובים...</p>}
          {data && <>
            <div className="research-controls">
              <SearchableSelect label="יישוב" key={electionId} value={locality?.id ?? ''} options={options} onChange={value => {
                setQuery(new URLSearchParams({ locality: value }));
              }} />
              {locality && stations.length > 1 && <SearchableSelect label="קלפי" key={`${electionId}:${locality.id}`}
                value={stationId ?? ''} options={[{ id: '', name: 'כל היישוב' }, ...stations.map(row => ({ id: row.id, name: stationLabel(row) }))]}
                onChange={value => {
                  if (value) navigate(localityHref(electionId, stations.find(row => row.id === value)!));
                  else navigate(localityHref(electionId, locality));
                }} />}
            </div>
            {!data.localities.length && <p>טרם פורסמו תוצאות לפי יישוב.</p>}
            {selectedId && !locality && <p role="alert">היישוב שבקישור אינו זמין במערכת בחירות זו.</p>}
            {locality && stationId && !selected && <p role="alert">הקלפי שבקישור אינה זמינה. <Link to={localityHref(electionId, locality)}>לתוצאות היישוב כולו</Link></p>}
            {selected && <>
              <h2>{selected.name}{selected.pollingStation ? ` — ${stationLabel(selected)}` : ''}</h2>
              {counting && <p className="research-notice">הספירה נמשכת: מוצגים הקולות שפורסמו עד כה. הנתונים מתרעננים אוטומטית.</p>}
              {electionManifest && electionManifest.phase !== 'final' && data.updated && <p>קובץ הנתונים עודכן: {new Date(data.updated).toLocaleString('he-IL')}</p>}
              <p>{format(selected.validVotes)} קולות כשרים · אחוז חסימה {format(electionConfig.blockPercentage * 100)}%</p>
              <div className="locality-table-wrap">
                <table className="locality-table" aria-label="תוצאות הרשימות">
                  <thead><tr><th scope="col">רשימה</th><th scope="col">קולות</th><th scope="col">אחוז</th><th scope="col">מנדטים</th></tr></thead>
                  <tbody>{parties.map(row => <tr key={row.party}>
                    <th scope="row"><Link className="party-research-link" to={`/research/${electionId}?${new URLSearchParams({ party: row.party, ...(selected.pollingStation ? { level: 'stations' } : {}) })}`}>{partyName(row.party)}</Link></th>
                    <td>{format(row.votes)}</td><td>{format(row.votes / selected.validVotes * 100)}%</td><td>{row.mandats}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </>}
          </>}
        </>}
      </section>
      {selected && hasBlocs && <section className="panel" aria-label="חלוקת גושים">
        <h2>חלוקת גושים</h2>
        <dl className="locality-blocs">{blocKeys.map(key => <div key={key}>
          <dt><span className="legend-swatch" style={{ '--chart-color': blocs.blocks[key].color } as React.CSSProperties} />{blocs.blocks[key].label}</dt>
          <dd>{blocTotals[key]} מנדטים</dd>
        </div>)}
          {unassignedSeats > 0 && <div><dt>ללא שיוך לגוש</dt><dd>{unassignedSeats} מנדטים</dd></div>}
        </dl>
      </section>}
    </main>
  </div>;
}
