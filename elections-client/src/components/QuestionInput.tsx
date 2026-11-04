import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { QuestionContext } from '../lib/election-questions';
import { createQuestionCompletions } from '../lib/question-completions';

interface Props { value: string; onChange: (value: string) => void; context?: QuestionContext; busy: boolean; disabled: boolean }

export default function QuestionInput({ value, onChange, context, busy, disabled }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const selected = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const complete = useMemo(() => context ? createQuestionCompletions(context) : null, [context]);
  const suggestions = complete?.(value) ?? { label: '', options: [] };
  const expanded = open && !disabled && suggestions.options.length > 0;
  const index = active < suggestions.options.length ? active : -1;
  useEffect(() => { selected.current?.scrollIntoView?.({ block: 'nearest' }); }, [index]);
  const choose = (next: string) => {
    onChange(next); setActive(-1); setOpen(true); input.current?.focus();
  };
  return <div className="question-composer" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <div className="question-input-row">
      <input ref={input} id="election-question" type="text" role="combobox" maxLength={600} autoComplete="off"
        aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? `${id}-options` : undefined}
        aria-activedescendant={expanded && index >= 0 ? `${id}-option-${index}` : undefined} aria-describedby={`${id}-hint`}
        value={value} disabled={disabled} placeholder="כתבו שאלה או בחרו התחלה…"
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
        onChange={event => { onChange(event.target.value); setActive(-1); setOpen(true); }}
        onKeyDown={event => {
          if (event.nativeEvent?.isComposing) return;
          if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1); }
          if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.options.length) {
            event.preventDefault(); setOpen(true);
            setActive((index + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.options.length) % suggestions.options.length);
          }
          if (event.key === 'Enter' && expanded && index >= 0) {
            event.preventDefault(); choose(suggestions.options[index].value);
          }
        }} />
      <button type="button" className="ui-button ui-button-quiet question-suggest-toggle" disabled={disabled || !suggestions.options.length}
        aria-label={expanded ? 'סגירת הצעות להמשך השאלה' : 'הצעות להמשך השאלה'} aria-expanded={expanded}
        aria-controls={expanded ? `${id}-options` : undefined}
        onClick={() => { setActive(-1); input.current?.focus(); setOpen(!expanded); }}><span aria-hidden="true">⌄</span></button>
      <button type="submit" className="ui-button ui-button-primary" disabled={disabled || !value.trim() || busy}
        aria-label="שליחת השאלה" onClick={() => setOpen(false)}>{busy ? 'מחשב…' : 'שאלו'}</button>
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
    <p id={`${id}-hint`} className="question-caption">אפשר לבחור חלקי שאלה או לכתוב חופשי. חצים לבחירה, Enter להשלמה; כשהשאלה מוכנה, Enter לשליחה.</p>
  </div>;
}
