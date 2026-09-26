import { useEffect, useRef } from 'react';
import { useStore } from '../../state/createStore';
import { settingsStore } from '../../state/settings';
import { TURN_LOOKS } from '../../engine/outputs';
import { syncStatus } from '../../remote/sync';
import { exportGame } from '../../state/archive';
import { liveGame } from '../../state/game';

export function SettingsPanel({ onClose, onExit, onReseat, onPrimaryStage, demo }: { onClose(): void; onExit(): void; onReseat(): void; onPrimaryStage(on: boolean): void; demo: boolean }) {
  const s = useStore(settingsStore);
  const saved = useStore(syncStatus).site;
  const ref = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<typeof s>) => settingsStore.set((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (ref.current && !ref.current.parentElement!.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  return (
    <div className="popover panel" ref={ref}>
      <label className="field">
        <span>Hold to end turn <b className="mono-num">{(s.holdMs / 1000).toFixed(1)}s</b></span>
        <input type="range" min={500} max={4000} step={100} value={s.holdMs} onChange={(e) => set({ holdMs: +e.target.value })} />
      </label>
      <label className="field">
        <span>Strategy card blink <b className="mono-num">{(s.flashMs / 1000).toFixed(1)}s</b></span>
        <input type="range" min={600} max={4000} step={100} value={s.flashMs} onChange={(e) => set({ flashMs: +e.target.value })} />
      </label>
      <div className="field" role="radiogroup" aria-label="Your-move light">
        <span>"Your move" light</span>
        <div className="looks">
          {TURN_LOOKS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={s.turnLight === l.id} title={l.hint} onClick={() => set({ turnLight: l.id })}>{l.name}</button>
          ))}
        </div>
        <small className="muted">Players can pick their own from their phone.</small>
      </div>
      <label className="field" title="Real buttons only. The screen's buttons don't change.">
        <span>Button brightness <b className="mono-num">{Math.round(s.brightness * 100)}%</b></span>
        <input type="range" min={0.1} max={1} step={0.05} value={s.brightness} onChange={(e) => set({ brightness: +e.target.value })} />
      </label>
      <label className="field">
        <span>Volume <b className="mono-num">{Math.round(s.volume * 100)}%</b></span>
        <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => set({ volume: +e.target.value })} />
      </label>
      <label className="field">
        <span>Cut uploaded clips after <b className="mono-num">{s.clipMaxSec}s</b></span>
        <input type="range" min={2} max={15} step={1} value={s.clipMaxSec} onChange={(e) => set({ clipMaxSec: +e.target.value })} />
      </label>
      <label className="toggle" title="On: the card's owner blinks while they do the primary, then taps to call everyone else. Off: everyone flashes the moment the card comes out.">
        <input type="checkbox" checked={s.primaryStage} onChange={(e) => { set({ primaryStage: e.target.checked }); onPrimaryStage(e.target.checked); }} />
        <span>Strategy cards: primary first, then secondaries</span>
      </label>
      <label className="toggle" title="Scoring happens in the status phase, so that's when everyone wants to read the objectives">
        <input type="checkbox" checked={s.autoScoreboard} onChange={(e) => set({ autoScoreboard: e.target.checked })} />
        <span>Show the scoreboard during the status phase</span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={s.explainLights} onChange={(e) => set({ explainLights: e.target.checked })} />
        <span>Explain each light under its button</span>
      </label>
      <button type="button" className="btn btn--sm" title="Swapped batteries or moved chairs? Everyone claims a button again; the game carries on where it was." onClick={() => { onReseat(); onClose(); }}>
        Re-claim seats
      </button>
      {!demo && (
        <p className="muted settings__save" data-state={saved} title="A copy of the game goes to the site a second after every change, so it can be picked up on another laptop with the room code">
          {saved === 'saved' ? 'Saved to the site' : saved === 'saving' ? 'Saving to the site…' : saved === 'offline' ? 'Not reaching the site: the game is only in this browser' : saved === 'taken' ? 'Picked up on another laptop: this copy no longer saves' : 'Saving to the site…'}
        </p>
      )}
      {!demo && (
        <button type="button" className="btn btn--sm" title="Every action with its time, as a JSON file, for working out statistics later" onClick={() => { const { base, events, game } = liveGame.get(); if (base && game) exportGame({ code: game.code, base, events, players: game.players.map((p) => p.name) }, game); }}>
          Download the game log
        </button>
      )}
      <button type="button" className="btn btn--sm btn--danger" onClick={onExit}>
        {demo ? 'Leave the demo' : 'End this game…'}
      </button>
    </div>
  );
}
