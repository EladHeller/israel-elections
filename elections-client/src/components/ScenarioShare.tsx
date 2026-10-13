import React, { useState } from 'react';
import { encodeSharedScenario, type SharedScenario } from '../lib/shared-scenario';

export default function ScenarioShare({ snapshot, disabled }: { snapshot: SharedScenario; disabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const share = async () => {
    setBusy(true);
    setMessage('');
    setLink('');
    try {
      const token = await encodeSharedScenario(snapshot);
      const url = `${window.location.origin}/simulator/${snapshot.election}#scenario=${token}`;
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
  return <section className="panel scenario-share" aria-label="שיתוף תרחיש">
    <div><button type="button" className="ghost" disabled={disabled || busy} onClick={share}>
      {busy ? 'מכין קישור…' : 'שיתוף תרחיש'}
    </button><span>הקישור שומר את הקולות וההגדרות כפי שהם עכשיו.</span></div>
    <span role="status">{message}</span>
    {link && <input aria-label="קישור לשיתוף התרחיש" dir="ltr" readOnly value={link} onFocus={event => event.target.select()} />}
  </section>;
}
