import { useEffect, useRef } from 'react';
import { useStore } from '../../state/createStore';
import { LAYOUTS, SCORING_CUES, settingsStore } from '../../state/settings';
import { DEFAULT_FANFARE_MS } from '../../engine/engine';
import { MIN_BRIGHTNESS, MIN_WAITING, TURN_EFFECTS, TURN_LOOKS } from '../../engine/outputs';
import { syncStatus } from '../../remote/sync';
import { exportGame } from '../../state/archive';
import { liveGame } from '../../state/game';

const pct = (x: number) => `${Math.round(x * 100)}%`;

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
      <div className="field" role="radiogroup" aria-label="Layout">
        <span>Layout</span>
        <div className="looks">
          {LAYOUTS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={s.layout === l.id} title={l.hint} onClick={() => set({ layout: l.id })}>{l.name}</button>
          ))}
        </div>
      </div>
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
      <div className="field" role="radiogroup" aria-label="Start of turn">
        <span>Start of turn</span>
        <div className="looks looks--wrap">
          {TURN_EFFECTS.map((e) => (
            <button key={e.id} type="button" role="radio" aria-checked={s.turnFx === e.id} title={e.hint} onClick={() => set({ turnFx: e.id })}>{e.name}</button>
          ))}
        </div>
        <small className="muted">What a button does the moment its turn starts. Players can pick their own from their phone.</small>
      </div>
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
      <div className="settings__h">Button brightness</div>
      <label className="field" title="Your move, and every steady light">
        <span>Your turn <b className="mono-num">{pct(s.brightness)}</b></span>
        <input type="range" min={MIN_BRIGHTNESS} max={1} step={0.05} value={s.brightness} onChange={(e) => set({ brightness: +e.target.value })} />
      </label>
      <label className="field" title="Everyone who is waiting, and the low point of a breathing or blinking light">
        <span>Waiting <b className="mono-num">{s.waitingBrightness > 0 ? pct(s.waitingBrightness) : 'off'}</b></span>
        <input type="range" min={MIN_WAITING} max={0.5} step={0.01} value={s.waitingBrightness} onChange={(e) => set({ waitingBrightness: +e.target.value })} />
      </label>
      <label className="field" title="Turn effects, and the press and the hold">
        <span>Effects <b className="mono-num">{pct(s.effectsBrightness)}</b></span>
        <input type="range" min={MIN_BRIGHTNESS} max={1} step={0.05} value={s.effectsBrightness} onChange={(e) => set({ effectsBrightness: +e.target.value })} />
      </label>
      <small className="muted">Of each real button's full brightness. Players can dim their own from their phone. The screen keeps your turn at full and the others in proportion.</small>
      <div className="settings__h">Status phase</div>
      <label className="toggle" title="When the last player passes, every light cycles through the rainbow for a moment">
        <input type="checkbox" checked={s.fanfareMs > 0} onChange={(e) => set({ fanfareMs: e.target.checked ? DEFAULT_FANFARE_MS : 0 })} />
        <span>Rainbows when everyone has passed</span>
      </label>
      {s.fanfareMs > 0 && (
        <label className="field">
          <span>Rainbows for <b className="mono-num">{(s.fanfareMs / 1000).toFixed(0)}s</b></span>
          <input type="range" min={1000} max={15000} step={1000} value={s.fanfareMs} onChange={(e) => set({ fanfareMs: +e.target.value })} />
        </label>
      )}
      <label className="toggle" title="On: after the rainbows, the first player in initiative order is called to score, taps when done, and so on round the table. Off: everyone scores at once.">
        <input type="checkbox" checked={s.scoreInOrder} onChange={(e) => set({ scoreInOrder: e.target.checked })} />
        <span>Score one player at a time, in initiative order</span>
      </label>
      {s.scoreInOrder && (
        <div className="field" role="radiogroup" aria-label="Scorer's cue">
          <span>When it's your turn to score</span>
          <div className="looks">
            {SCORING_CUES.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={s.scoringCue === c.id} title={c.hint} onClick={() => set({ scoringCue: c.id })}>{c.name}</button>
            ))}
          </div>
        </div>
      )}
      <label className="toggle" title="Scoring happens in the status phase, so that's when everyone wants to read the objectives">
        <input type="checkbox" checked={s.autoScoreboard} onChange={(e) => set({ autoScoreboard: e.target.checked })} />
        <span>Show the scoreboard during the status phase</span>
      </label>
      <div className="settings__h">This game</div>
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
