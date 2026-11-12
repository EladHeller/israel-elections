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
    <button type="button" className="theme-toggle" aria-label="מצב כהה" role="switch" aria-checked={isDark} onClick={toggleTheme}>
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-night" />
      </span>
      <span className="theme-toggle-carriage" aria-hidden="true">
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
