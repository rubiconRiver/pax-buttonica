import './styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { CrashGuard } from './components/CrashGuard';
import { startProfileSync } from './state/profileSync';
import { settingsStore } from './state/settings';

// The blink speed is a CSS variable so every button on every page follows the setting.
const applyFlash = () => document.documentElement.style.setProperty('--flash-ms', `${settingsStore.get().flashMs}ms`);
applyFlash();
settingsStore.subscribe(applyFlash);

startProfileSync();

const root = document.getElementById('root')!;
createRoot(root, {
  // Only reached if the crash screen itself throws: plain HTML with a way back, rather than a blank page.
  onUncaughtError(error) {
    console.error(error);
    queueMicrotask(() => {
      root.innerHTML = '<div class="crash"><div class="crash__card panel"><h1>The screen hit a snag</h1><p>The game is still saved in this browser.</p><div class="crash__actions"><button type="button" class="btn btn--gold">Reload</button></div></div></div>';
      root.querySelector('button')!.addEventListener('click', () => window.location.reload());
    });
  },
}).render(
  <StrictMode>
    <BrowserRouter>
      <CrashGuard>
        <App />
      </CrashGuard>
    </BrowserRouter>
  </StrictMode>,
);
