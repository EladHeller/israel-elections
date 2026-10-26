import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import './styles.css';
import './election-night.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container #root not found in DOM');
}

createRoot(container).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <footer className="site-footer" dir="rtl">
        <a href="https://github.com/EladHeller/israel-elections" target="_blank" rel="noopener noreferrer">
          קוד המקור ב־GitHub
        </a>
      </footer>
    </BrowserRouter>
  </React.StrictMode>,
);

