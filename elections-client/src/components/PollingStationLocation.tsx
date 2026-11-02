import React, { useId, useState } from 'react';
import { locationMapLinks, type PollingLocation } from '../lib/polling-locations';

export default function PollingStationLocation({ location, localityName }: { location?: PollingLocation; localityName: string }) {
  const [open, setOpen] = useState(false);
  const mapId = useId();
  if (!location) return null;
  const links = locationMapLinks(location);
  return <section className="polling-location" aria-label="מקום הקלפי">
    <div className="polling-location-heading">
      <div><strong>{location.name}</strong><p>{location.address} · {localityName}</p></div>
      <div className="polling-location-actions">
        <a className="ui-link" href={links.google} target="_blank" rel="noopener noreferrer" aria-label={`פתיחת ${location.name} ב־Google Maps (חלון חדש)`}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
          Google Maps
        </a>
        <button type="button" className="ui-button ui-button-quiet" aria-expanded={open} aria-controls={mapId} onClick={() => setOpen(value => !value)}>{open ? 'הסתר מפה' : 'הצג במפה'}</button>
      </div>
    </div>
    <div id={mapId} hidden={!open}>{open && <iframe title={`מיקום הקלפי: ${location.name}, ${localityName}`} src={links.embed} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" className="polling-location-map" />}</div>
    <small>מקור: <a className="ui-link" href="https://www.over.org.il/versions/5d2fcaf8-76bc-426f-a9f9-4828f0064535" target="_blank" rel="noopener noreferrer">נתוני ועדת הבחירות ב־GovMap, דרך גרסאות לעם</a></small>
  </section>;
}
