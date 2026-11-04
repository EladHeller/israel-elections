import React, { useEffect, useId, useRef, useState } from 'react';
import { numberReplacement, type QuestionNumber } from '../lib/question-number';

export default function QuestionNumberChip({ value, config, onChange }: { value: string; config: QuestionNumber; onChange: (value: string) => void }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const show = () => { setDraft(value.normalize('NFKC').replace('%', '').replaceAll(',', '')); setError(''); setOpen(true); };
  const save = () => {
    const result = numberReplacement(draft, config);
    if ('error' in result) { setError(result.error); return; }
    onChange(result.text); close();
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div ref={root} className="searchable-select-control question-entity-chip question-number-chip" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="election-selector-trigger" aria-label={`עריכת ${config.label}: ${value}`}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-editor`} onClick={() => open ? setOpen(false) : show()}>
      <bdi dir="ltr">{value}</bdi><span className="election-selector-chevron" aria-hidden="true" />
    </button>
    {open && <div id={`${id}-editor`} role="dialog" aria-labelledby={`${id}-label`} className="election-selector-menu question-number-editor"
      onKeyDown={event => {
        if (event.nativeEvent?.isComposing) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
        if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); save(); }
      }}>
      <label id={`${id}-label`} htmlFor={`${id}-number`}>{config.label}</label>
      <input id={`${id}-number`} autoFocus type="text" inputMode={config.percent ? 'decimal' : 'numeric'} dir="ltr"
        value={draft} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        onFocus={event => event.target.select()} onChange={event => { setDraft(event.target.value); setError(''); }} />
      {error && <p id={`${id}-error`} className="question-error" role="alert">{error}</p>}
      <div className="question-number-actions"><button type="button" className="ui-button ui-button-primary" onClick={save}>שמירה</button>
        <button type="button" className="ui-button ui-button-quiet" onClick={close}>ביטול</button></div>
    </div>}
  </div>;
}
