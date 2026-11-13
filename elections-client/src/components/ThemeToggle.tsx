import React, { useRef, useState } from 'react';

type SwitchPointer = React.PointerEvent<HTMLButtonElement>;

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  startProgress: number;
  travel: number;
  direction: 1 | -1;
  moved: boolean;
}

const movedBeyondTap = (drag: Drag, event: SwitchPointer) =>
  Math.max(Math.abs(event.clientX - drag.startX), Math.abs(event.clientY - drag.startY)) >= 5;

const progressAt = (drag: Drag, x: number) => {
  const offset = (x - drag.startX) * drag.direction;
  return Math.min(1, Math.max(0, drag.startProgress + offset / drag.travel));
};

const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const carriage = useRef<HTMLSpanElement>(null);
  const drag = useRef<Drag | null>(null);
  const ignorePointerClick = useRef(false);

  const applyTheme = (nextIsDark: boolean) => {
    const theme = nextIsDark ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    setIsDark(nextIsDark);
    try {
      localStorage.setItem('israel-elections-theme', theme);
    } catch {
      // The toggle remains usable when browser storage is unavailable.
    }
  };

  const startDrag = (event: SwitchPointer) => {
    if (!event.isPrimary || event.button !== 0 || drag.current) return;
    ignorePointerClick.current = false;
    const button = event.currentTarget;
    const knob = carriage.current!;
    const direction = button.matches(':dir(rtl)') ? -1 : 1;
    const inset = direction === -1 ? button.clientWidth - knob.offsetLeft - knob.offsetWidth : knob.offsetLeft;
    const travel = button.clientWidth - 2 * inset - knob.offsetWidth;
    if (travel <= 0) return;

    // Grab the visible position, even if a previous slide is still settling.
    const restX = button.getBoundingClientRect().left + button.clientLeft + knob.offsetLeft;
    const startProgress = (knob.getBoundingClientRect().left - restX) * direction / travel;
    drag.current = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      startProgress, travel, direction, moved: false,
    };
    button.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: SwitchPointer) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.moved && !movedBeyondTap(current, event)) return;
    current.moved = true;
    setDragProgress(progressAt(current, event.clientX));
  };

  const finishDrag = (event: SwitchPointer) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragProgress(null);
    if (!current.moved && !movedBeyondTap(current, event)) return;
    ignorePointerClick.current = true;
    const nextIsDark = progressAt(current, event.clientX) >= 0.5;
    if (nextIsDark !== isDark) applyTheme(nextIsDark);
  };

  const cancelDrag = (event: SwitchPointer) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    ignorePointerClick.current = true;
    setDragProgress(null);
  };

  const toggleTheme = (event: React.MouseEvent<HTMLButtonElement>) => {
    // The browser can dispatch a click after pointerup, including after a drag.
    // Keyboard and assistive technology clicks have a detail of zero.
    if (ignorePointerClick.current && event.detail !== 0) {
      ignorePointerClick.current = false;
      return;
    }
    applyTheme(!isDark);
  };

  return (
    <button type="button" className="theme-toggle" aria-label="מצב כהה" role="switch" aria-checked={isDark}
      data-dragging={dragProgress !== null ? '' : undefined}
      style={dragProgress === null ? undefined : { '--switch-drag-progress': dragProgress } as React.CSSProperties}
      onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag}
      onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag} onClick={toggleTheme}>
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-night" />
      </span>
      <span ref={carriage} className="theme-toggle-carriage" aria-hidden="true">
        <span className="theme-toggle-thumb">
          <span className="theme-toggle-rim" />
          <span className="theme-toggle-lens">
            <svg className="theme-toggle-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" focusable="false">
              <circle cx="12" cy="12" r="3.8" fill="currentColor" stroke="none" />
              <path d="M12 2.8v2.4m0 13.6v2.4M2.8 12h2.4m13.6 0h2.4M5.5 5.5l1.7 1.7m9.6 9.6 1.7 1.7M5.5 18.5l1.7-1.7m9.6-9.6 1.7-1.7" />
            </svg>
            <svg className="theme-toggle-moon" viewBox="0 0 24 24" fill="currentColor" focusable="false">
              <path d="M20.6 14.4A8.7 8.7 0 0 1 9.6 3.5a8.8 8.8 0 1 0 11 10.9Z" />
              <path d="m17 4 .9 2.1L20 7l-2.1.9L17 10l-.9-2.1L14 7l2.1-.9Z" />
            </svg>
          </span>
        </span>
      </span>
    </button>
  );
};

export default ThemeToggle;
