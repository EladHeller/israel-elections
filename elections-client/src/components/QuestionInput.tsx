import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { QuestionContext } from '../lib/election-questions';
import { createQuestionCompletions } from '../lib/question-completions';
import { emptyQuestionPlaces, questionEntities, replaceQuestionEntity, type QuestionPlaces } from '../lib/question-entities';
import SearchableSelect from './SearchableSelect';

interface Props { value: string; onChange: (value: string) => void; context?: QuestionContext; busy: boolean; disabled: boolean;
  places?: QuestionPlaces; placesLoading?: boolean; placesError?: boolean; retryPlaces?: () => void }

export default function QuestionInput({ value, onChange, context, busy, disabled, places = emptyQuestionPlaces,
  placesLoading, placesError, retryPlaces }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const focusAfterChoice = useRef(false);
  const selected = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [editing, setEditing] = useState(false);
  const complete = useMemo(() => context ? createQuestionCompletions(context, places) : null, [context, places.localities, places.stations]);
  const entities = useMemo(() => context ? questionEntities(value, context, places) : [], [value, context, places.localities, places.stations]);
  const tokenized = !editing && entities.length > 0 && !disabled;
  const suggestions = complete?.(value) ?? { label: '', options: [] };
  const expanded = open && !disabled && suggestions.options.length > 0;
  const index = active < suggestions.options.length ? active : -1;
  useEffect(() => { selected.current?.scrollIntoView?.({ block: 'nearest' }); }, [index]);
  useEffect(() => {
    if (editing) { input.current?.focus(); focusAfterChoice.current = false; }
    else if (focusAfterChoice.current) {
      focusAfterChoice.current = false;
      if (tokenized) preview.current?.focus?.(); else input.current?.focus();
    }
  }, [editing, tokenized, value]);
  const choose = (next: string) => {
    focusAfterChoice.current = true;
    onChange(next); setActive(-1); setOpen(true); setEditing(false);
  };
  const keys = (event: React.KeyboardEvent, fromPreview = false) => {
    if (event.nativeEvent?.isComposing || event.defaultPrevented) return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1); }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.options.length) {
      event.preventDefault(); setOpen(true);
      setActive(index < 0 ? (event.key === 'ArrowDown' ? 0 : suggestions.options.length - 1)
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.options.length) % suggestions.options.length);
    }
    if (event.key === 'Enter' && expanded && index >= 0) { event.preventDefault(); choose(suggestions.options[index].value); }
    else if (event.key === 'Enter' && tokenized && fromPreview) { event.preventDefault(); input.current?.form?.requestSubmit(); }
  };
  const parts: React.ReactNode[] = [];
  let offset = 0;
  for (const entity of entities) {
    parts.push(<span key={`text-${entity.start}`}>{value.slice(offset, entity.start)}</span>);
    parts.push(<SearchableSelect key={`${entity.kind}-${entity.start}`} variant="chip"
      label={entity.kind === 'party' ? 'רשימה' : entity.kind === 'locality' ? 'יישוב' : 'קלפי'} value={entity.id} options={entity.options}
      onChange={next => { setOpen(false); setActive(-1); onChange(replaceQuestionEntity(value, entity, next, context!)); }} />);
    offset = entity.end;
  }
  parts.push(<span key="tail">{value.slice(offset)}</span>);
  const accessibility = { 'aria-expanded': expanded, 'aria-controls': expanded ? `${id}-options` : undefined,
    'aria-activedescendant': expanded && index >= 0 ? `${id}-option-${index}` : undefined, 'aria-describedby': `${id}-hint` };
  return <div className="question-composer" onBlur={event => {
    if (!focusAfterChoice.current && !event.currentTarget.contains(event.relatedTarget as Node | null)) { setOpen(false); setEditing(false); }
  }}>
    <div className="question-input-row">
      {tokenized && <div className="question-tokenized" ref={preview} role="combobox" tabIndex={0} aria-label="השאלה שלכם"
        aria-autocomplete="list" {...accessibility} onKeyDown={event => { if (event.target === event.currentTarget) keys(event, true); }}>
        {parts}
      </div>}
      <input ref={input} id="election-question" type="text" role="combobox" maxLength={600} autoComplete="off" hidden={tokenized}
        aria-autocomplete="list" {...accessibility} value={value} disabled={disabled} placeholder="כתבו שאלה או בחרו התחלה…"
        onFocus={() => { setEditing(true); setOpen(true); }} onClick={() => { setEditing(true); setOpen(true); }}
        onChange={event => { onChange(event.target.value); setEditing(true); setActive(-1); setOpen(true); }} onKeyDown={keys} />
      {tokenized && <button type="button" className="ui-button ui-button-quiet question-edit-text" onClick={() => { focusAfterChoice.current = true; setEditing(true); }}>עריכת טקסט</button>}
      <button type="button" className="ui-button ui-button-quiet question-suggest-toggle" disabled={disabled || !suggestions.options.length}
        aria-label={expanded ? 'סגירת הצעות להמשך השאלה' : 'הצעות להמשך השאלה'} aria-expanded={expanded}
        aria-controls={expanded ? `${id}-options` : undefined}
        onClick={() => { setActive(-1); if (tokenized) preview.current?.focus?.(); else input.current?.focus(); setOpen(!expanded); }}><span aria-hidden="true">⌄</span></button>
      <button type="submit" className="ui-button ui-button-primary" disabled={disabled || !value.trim() || busy}
        aria-label="שליחת השאלה" onClick={() => { setOpen(false); setEditing(false); }}>{busy ? 'מחשב…' : 'שאלו'}</button>
    </div>
    {expanded && <div className="question-completions election-selector-menu">
      <p id={`${id}-label`} className="question-completion-label">{suggestions.label}</p>
      <div id={`${id}-options`} role="listbox" aria-labelledby={`${id}-label`} className="searchable-select-options">
        {suggestions.options.map((option, i) => <button key={option.value} id={`${id}-option-${i}`} type="button" role="option"
          ref={i === index ? selected : undefined} tabIndex={-1} aria-selected={i === index}
          className={i === index ? 'is-active' : ''} onMouseDown={event => event.preventDefault()} onClick={() => choose(option.value)}>
          <span>{option.label}{option.detail && <small>{option.detail}</small>}</span><span aria-hidden="true">←</span>
        </button>)}
      </div>
    </div>}
    {placesLoading && <p className="question-caption" role="status">טוען שמות יישובים וקלפיות…</p>}
    {placesError && <p className="question-caption" role="status">טעינת השמות נכשלה. <button type="button" className="ui-button ui-button-quiet" onClick={retryPlaces}>ניסיון נוסף</button></p>}
    <p id={`${id}-hint`} className="question-caption">לחצו על שם כדי להחליף אותו. אפשר גם לערוך כטקסט חופשי. חצים לבחירה, Enter להשלמה ולשליחה.</p>
  </div>;
}
