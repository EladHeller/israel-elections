import React, { useEffect, useId, useRef, useState } from 'react';

interface ElectionSelectorProps {
  value: string | null;
  elections: string[];
  onChange: (electionId: string) => void;
  disabled?: boolean;
}

const electionLabel = (electionId: string | null): string =>
  electionId ? `הכנסת ה־${electionId}` : 'בחירת כנסת';

const ElectionSelector: React.FC<ElectionSelectorProps> = ({
  value,
  elections,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const id = useId();
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const listboxId = `${id}-listbox`;

  const selectedIndex = Math.max(0, elections.indexOf(value ?? ''));
  const isDisabled = disabled || elections.length === 0;

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      optionRefs.current[activeIndex]?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [isOpen]);

  useEffect(() => {
    if (isDisabled) setIsOpen(false);
  }, [isDisabled]);

  const openAt = (index: number) => {
    setActiveIndex(index);
    setIsOpen(true);
  };

  const closeAndFocusTrigger = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const selectElection = (electionId: string) => {
    onChange(electionId);
    closeAndFocusTrigger();
  };

  const focusOption = (index: number) => {
    if (elections.length === 0) return;
    const normalizedIndex = (index + elections.length) % elections.length;
    setActiveIndex(normalizedIndex);
  };

  const handleOptionKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusOption(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusOption(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusOption(0);
        break;
      case 'End':
        event.preventDefault();
        focusOption(elections.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        closeAndFocusTrigger();
        break;
      default:
        break;
    }
  };

  return (
    <div
      className="election-control"
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false);
        }
      }}
    >
      <span id={labelId}>כנסת</span>
      <div className={`election-selector ${isOpen ? 'is-open' : ''}`}>
        <button
          ref={triggerRef}
          type="button"
          className="election-selector-trigger"
          aria-labelledby={`${labelId} ${valueId}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          disabled={isDisabled}
          onClick={() => {
            if (isOpen) {
              setIsOpen(false);
            } else {
              openAt(selectedIndex);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              openAt(
                event.key === 'ArrowUp'
                  ? Math.max(0, elections.length - 1)
                  : selectedIndex,
              );
            }
          }}
        >
          <span id={valueId}>{electionLabel(value)}</span>
          <span className="election-selector-chevron" aria-hidden="true" />
        </button>

        {isOpen && (
          <div
            id={listboxId}
            className="election-selector-menu"
            role="listbox"
            aria-labelledby={labelId}
          >
            {elections.map((election, index) => (
              <button
                key={election}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                type="button"
                role="option"
                aria-selected={election === value}
                className={election === value ? 'is-selected' : ''}
                tabIndex={index === activeIndex ? 0 : -1}
                onFocus={() => setActiveIndex(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                onClick={() => selectElection(election)}
              >
                <span>{electionLabel(election)}</span>
                {election === value && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ElectionSelector;
