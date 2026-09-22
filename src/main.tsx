import './styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { startProfileSync } from './state/profileSync';
import { settingsStore } from './state/settings';

// The blink speed is a CSS variable so every button on every page follows the setting.
const applyFlash = () => document.documentElement.style.setProperty('--flash-ms', `${settingsStore.get().flashMs}ms`);
applyFlash();
settingsStore.subscribe(applyFlash);

startProfileSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
