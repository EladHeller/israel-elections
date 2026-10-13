import React, { useState } from 'react';

const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState(() => document.documentElement.dataset.theme === 'dark');

  const toggleTheme = () => {
    const nextIsDark = !isDark;
    const theme = nextIsDark ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    setIsDark(nextIsDark);
    try {
      localStorage.setItem('israel-elections-theme', theme);
    } catch {
      // The toggle remains usable when browser storage is unavailable.
    }
  };

  return (
    <button type="button" className="theme-toggle" aria-label="מצב כהה" aria-pressed={isDark} onClick={toggleTheme}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {isDark ? (
          <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>
        ) : (
          <path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" />
        )}
      </svg>
      <span>{isDark ? 'מצב בהיר' : 'מצב כהה'}</span>
    </button>
  );
};

export default ThemeToggle;
