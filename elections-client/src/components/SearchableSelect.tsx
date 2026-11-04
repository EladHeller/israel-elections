import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

interface Props {
  label: string;
  value: string;
  options: { id: string; name: string }[];
  onChange: (value: string) => void;
  variant?: 'chip';
}

export default function SearchableSelect({ label, value, options, onChange, variant }: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const activeOption = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  const matches = useMemo(() => options.filter(option => option.name.includes(search.trim())), [options, search]);
  const selected = options.find(option => option.id === value);
  const activeIndex = Math.min(active, Math.max(0, matches.length - 1));
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const choose = (next: string) => { onChange(next); close(); };
  const show = () => { setSearch(''); setActive(Math.max(0, options.findIndex(option => option.id === value))); setOpen(true); };

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  useEffect(() => { activeOption.current?.scrollIntoView({ block: 'nearest' }); }, [open, activeIndex, search]);

  return <div className={`searchable-select-control${variant === 'chip' ? ' question-entity-chip' : ''}`}  ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <span id={`${id}-label`}>{label}</span>
    <div className={`election-selector${open ? ' is-open' : ''}`}>
      <button ref={trigger} type="button" className="election-selector-trigger" aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={open} aria-haspopup="dialog" aria-controls={`${id}-popup`}
        onClick={() => open ? setOpen(false) : show()} onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(); }
        }}>
        <span id={`${id}-value`}>{selected?.name ?? `בחירת ${label}`}</span>
        <span className="election-selector-chevron" aria-hidden="true" />
      </button>
      {open && <div id={`${id}-popup`} role="dialog" aria-labelledby={`${id}-label`} className="election-selector-menu searchable-select-menu">
        <input autoFocus type="search" role="combobox" aria-label={`חיפוש ${label}`} placeholder={`חיפוש ${label}...`}
          aria-expanded="true" aria-autocomplete="list" aria-controls={`${id}-options`}
          aria-activedescendant={matches.length ? `${id}-option-${activeIndex}` : undefined}
          value={search} onChange={event => { setSearch(event.target.value); setActive(0); }}
          onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              if (matches.length) setActive((activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
            }
            if (event.key === 'Enter' && matches.length) { event.preventDefault(); choose(matches[activeIndex].id); }
          }} />
        <div id={`${id}-options`} role="listbox" aria-labelledby={`${id}-label`} className="searchable-select-options">
          {matches.map((option, index) => <button key={option.id} id={`${id}-option-${index}`} type="button" role="option"
            ref={index === activeIndex ? activeOption : undefined} tabIndex={-1} aria-selected={option.id === value}
            className={`${option.id === value ? 'is-selected' : ''}${index === activeIndex ? ' is-active' : ''}`}
            onMouseDown={event => event.preventDefault()} onClick={() => choose(option.id)}>
            <span>{option.name}</span>{option.id === value && <span aria-hidden="true">✓</span>}
          </button>)}
        </div>
        {!matches.length && <p role="status">לא נמצאו תוצאות התואמות לחיפוש.</p>}
      </div>}
    </div>
  </div>;
}
