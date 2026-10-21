import React, { useEffect, useRef, useState } from 'react';
import { createSharedScenario } from '../lib/scenario-share-api';
import type { SharedScenario } from '../lib/shared-scenario';

export default function ScenarioShare({ snapshot, disabled }: { snapshot: SharedScenario; disabled: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  useEffect(() => {
    if (!message) return;
    const close = () => { setMessage(''); setLink(''); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    const onPointer = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) close();
    };
    const timer = message === 'הקישור הועתק' ? window.setTimeout(close, 2500) : undefined;
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [message]);
  const share = async () => {
    setBusy(true);
    setMessage('');
    setLink('');
    try {
      const id = await createSharedScenario(snapshot);
      const url = `${window.location.origin}/s/${id}`;
      try {
        await navigator.clipboard.writeText(url);
        setMessage('הקישור הועתק');
      } catch {
        setLink(url);
        setMessage('אפשר להעתיק את הקישור מהשדה הבא');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'לא ניתן ליצור קישור לשיתוף.');
    } finally { setBusy(false); }
  };
  return <div className="scenario-share" ref={container}>
    <button type="button" className="scenario-share-button" aria-label="שיתוף תרחיש"
      disabled={disabled || busy} aria-busy={busy} onClick={share}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
      </svg>
      <span>{busy ? 'מכין…' : 'שיתוף תרחיש'}</span>
    </button>
    <span className={message ? 'scenario-share-feedback' : 'scenario-share-announcement'} role="status">
      {message}
      {link && <input autoFocus aria-label="קישור לשיתוף התרחיש" dir="ltr" readOnly value={link}
        onFocus={event => event.target.select()} />}
    </span>
  </div>;
}
