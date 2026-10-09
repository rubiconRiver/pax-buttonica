import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { playNotes, sfx, unlockAudio } from '../audio/synth';
import { EARLY_LOCK_MS, PHOTO_FINISH_MS, VALUES, fromSaved, outputs, reduce, toSaved, winnerOf, type Action, type BuzzerState, type Event, type Saved } from '../buzzer/engine';
import { deviceTag } from '../engine/engine';
import { connectHub, hubStatus, sendToDevice, serialSupported, setCfgOverride, setGestureHandler, watchHub } from '../hardware/serial';
import { ledFrame, type ToDevice } from '../hardware/protocol';
import { useStore } from '../state/createStore';
import '../styles/buzzer.css';

const STORAGE = 'pb.buzzer.v1';
/** How a `flash` would blink; nothing here flashes, but the frame wants a number. */
const FLASH_MS = 2000;

function load(): BuzzerState {
  try {
    return fromSaved(JSON.parse(localStorage.getItem(STORAGE) ?? 'null') as Partial<Saved> | null);
  } catch {
    return fromSaved(null);
  }
}

/** The buttons' settings for a quiz: radios always on so lights land at once; a hold on a player's button means nothing, on the host's it is "next question". */
const cfgFor = (host: string | null) => (dev: string): ToDevice => ({ t: 'cfg', dev, hold: dev === host ? 1500 : 10000, flash: FLASH_MS, bright: 70, dim: 12, fx: 90, pulse: 'pulse', ps: 0 });

/** What just happened: an effect on the button it concerns and a sound from the laptop. Fired as each action lands, so two presses in one breath both get theirs. */
function fire(ev: Event) {
  switch (ev.kind) {
    case 'opened':
      sfx.allClear();
      break;
    case 'closed':
    case 'next':
      sfx.click();
      break;
    case 'buzz':
      playNotes([[45, 60], [45, 340]], 'sawtooth');
      sendToDevice({ t: 'fx', dev: ev.dev, k: 'burst' });
      break;
    case 'early':
      sfx.denied();
      sendToDevice({ t: 'fx', dev: ev.dev, k: 'denied' });
      break;
    case 'correct':
      sfx.confirm();
      sendToDevice({ t: 'fx', dev: ev.dev, k: 'confetti' });
      break;
    case 'wrong':
      sfx.denied();
      sendToDevice({ t: 'fx', dev: ev.dev, k: 'denied' });
      if (ev.reopened) setTimeout(() => sfx.allClear(), 350);
      break;
    case 'claimed':
      sfx.ack();
      sendToDevice({ t: 'fx', dev: ev.dev, k: 'ack' });
      break;
    case 'late':
      break;
  }
}

const ms = (n: number) => `${Math.round(n)} ms`;
const seconds = (n: number) => `${(n / 1000).toFixed(3)} s`;

/**
 * A quiz night on the buttons. The host opens the floor (their button, or the space bar); the first press wins it and
 * the laptop judges. Drives the hub directly, with its own small engine in src/buzzer/: no TI rules involved.
 */
export function Buzzer() {
  const hub = useStore(hubStatus);
  const [state, setState] = useState(load);
  // The engine runs off this ref, not the rendered state: presses arrive faster than React renders, and each one must
  // see the one before it (and get its own effect and sound).
  const stateRef = useRef(state);
  const dispatch = useCallback((a: Action) => {
    const next = reduce(stateRef.current, a);
    if (next === stateRef.current) return;
    stateRef.current = next;
    if (next.event) fire(next.event);
    setState(next);
  }, []);
  // The lights go by the clock too (an early lockout runs out); this nudges a render when one does.
  const [, setTick] = useState(0);
  const lastFrames = useRef(new Map<string, string>());
  /** Buttons whose firmware reports `down`: their `tap` is the same press again and is ignored. */
  const reportsDown = useRef(new Set<string>());

  // The hub, and every gesture from it.
  useEffect(() => {
    setGestureHandler((dev, b, e, at) => {
      if (b !== 0) return;
      const s = stateRef.current;
      if (dev === s.host) {
        // The host's timing doesn't matter: act on the gesture, so a hold is not also a tap.
        if (e === 'tap') dispatch({ type: 'HOST_TAP', at });
        else if (e === 'hold') dispatch({ type: 'NEXT' });
        return;
      }
      if (!s.players.some((p) => p.dev === dev)) {
        // A button nobody has claimed: its release claims it, so the press that makes it the host's can't also open the floor.
        if (e === 'tap') dispatch({ type: 'PRESS', dev, at });
        return;
      }
      if (e === 'down') {
        reportsDown.current.add(dev);
        dispatch({ type: 'PRESS', dev, at });
      } else if (e === 'tap' && !reportsDown.current.has(dev)) {
        dispatch({ type: 'PRESS', dev, at });
      }
    });
    const unwatch = watchHub();
    void connectHub({ silent: true });
    return () => {
      setGestureHandler(null);
      unwatch();
      // Let the radios sleep again, then hand the settings back to the game.
      for (const d of hubStatus.get().devices) sendToDevice({ t: 'cfg', dev: d.dev, hold: 900, ps: 1 });
      setCfgOverride(null);
    };
  }, []);

  // Our settings, on every button, as long as this page is up (and again whenever the host changes).
  useEffect(() => {
    setCfgOverride(cfgFor(state.host));
  }, [state.host]);

  // Remember who is who and the scores.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(toSaved(state)));
    } catch {
      // nowhere to keep it
    }
  }, [state.host, state.players, state.value, state.question]);

  // Lights: what the engine says, sent only when it changes. Lockouts that run out by themselves get a nudge.
  useEffect(() => {
    if (!hub.connected) {
      lastFrames.current.clear();
      return;
    }
    const now = performance.now();
    const lights = outputs(state, hub.devices.filter((d) => !d.lost).map((d) => d.dev), now);
    for (const [dev, light] of lights) {
      const key = `${light.color}|${light.mode}`;
      if (lastFrames.current.get(dev) === key) continue;
      lastFrames.current.set(dev, key);
      sendToDevice(ledFrame(dev, { color: light.color, mode: light.mode, reason: '', hold: false }, FLASH_MS, 'pulse'));
    }
    const soonest = Math.min(...Object.values(state.early).filter((t) => t > now));
    if (Number.isFinite(soonest)) {
      const t = setTimeout(() => setTick((n) => n + 1), soonest - now + 5);
      return () => clearTimeout(t);
    }
  });

  // A button that comes back (or arrives) is told its light afresh.
  useEffect(() => {
    for (const d of hub.devices) if (d.lost) lastFrames.current.delete(d.dev);
  }, [hub.devices]);

  // The keyboard is the host's other button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, select, textarea')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      unlockAudio();
      const s = stateRef.current;
      const at = performance.now();
      const act = (a: Action) => {
        e.preventDefault();
        dispatch(a);
      };
      if (e.key === ' ') {
        if (s.phase === 'closed') act({ type: 'OPEN', at });
        else if (s.phase === 'open') act({ type: 'CLOSE' });
        else e.preventDefault();
      } else if (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === '+' || e.key === '=') act({ type: 'CORRECT' });
      else if (e.key === 'Backspace' || e.key === 'ArrowDown' || e.key === '-' || e.key === '_') act({ type: 'WRONG', at });
      else if (e.key === 'Escape' || e.key === 'n' || e.key === 'N') act({ type: 'NEXT' });
      else if (/^[1-8]$/.test(e.key)) act({ type: 'SET_VALUE', value: VALUES[Number(e.key) - 1] });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const click = useCallback((a: Action) => {
    unlockAudio();
    dispatch(a);
  }, []);

  const winner = winnerOf(state);
  const now = performance.now();
  const lockedOut = (dev: string) => state.out.includes(dev) || (state.early[dev] ?? 0) > now;
  const playerOf = (dev: string) => state.players.find((p) => p.dev === dev);
  const nameOf = (dev: string) => playerOf(dev)?.name ?? (dev === state.host ? 'Host' : deviceTag(dev).slice(-4));
  const roleOf = (dev: string): 'host' | 'player' | 'spare' => (dev === state.host ? 'host' : playerOf(dev) ? 'player' : 'spare');
  const lead = Math.max(...state.players.map((p) => p.score));

  return (
    <div className="buzzer" data-phase={state.phase}>
      <header className="setup__head">
        <Link to="/" className="brand"><span className="brand__dot" /><span>Pax <b>Buttonica</b></span></Link>
        <div className="buzzer__hub">
          {!serialSupported() ? (
            <span className="chip">No Web Serial: use Chrome or Edge</span>
          ) : hub.connected ? (
            <span className="chip chip--gold" data-testid="hub-chip">Hub · {hub.devices.filter((d) => !d.lost).length} button{hub.devices.length === 1 ? '' : 's'}</span>
          ) : (
            <button type="button" className="btn btn--sm btn--gold" onClick={() => void connectHub()}>Connect the hub</button>
          )}
          {hub.error && <span className="buzzer__error">{hub.error}</span>}
          <Link to="/bench" className="btn btn--sm btn--ghost">Bench</Link>
        </div>
      </header>

      <section className="buzzer__top">
        <div>
          <div className="eyebrow">Buzzer</div>
          <h1>{state.question === 0 ? 'First question' : `Question ${state.question + 1}`}</h1>
        </div>
        <div className="buzzer__values" role="radiogroup" aria-label="Worth">
          {VALUES.map((v, i) => (
            <button key={v} type="button" role="radio" aria-checked={state.value === v} className="buzzer__value" onClick={() => click({ type: 'SET_VALUE', value: v })}>
              <small>{i + 1}</small>
              {v}
            </button>
          ))}
        </div>
      </section>

      <section className="panel buzzer__stage" aria-live="polite">
        {state.phase === 'closed' && (
          <div className="buzzer__closed">
            <div className="buzzer__big muted">Floor closed</div>
            <p className="muted">Read the question, then <b>space</b> or the host's button opens it. {state.host ? '' : 'Press the host’s button first: the first button pressed is the host’s, the rest are players.'}</p>
            <button type="button" className="btn btn--gold btn--lg" onClick={() => click({ type: 'OPEN', at: performance.now() })}>Open the floor</button>
          </div>
        )}
        {state.phase === 'open' && (
          <div className="buzzer__open">
            <div className="buzzer__big buzzer__go">Go</div>
            <p className="muted">{state.out.length ? `${state.out.map(nameOf).join(', ')} out for this question.` : 'First press takes it.'}</p>
            <button type="button" className="btn btn--ghost" onClick={() => click({ type: 'CLOSE' })}>Close it (space)</button>
          </div>
        )}
        {state.phase === 'won' && winner && (
          <div className="buzzer__won" style={{ '--pc': winner.color } as CSSProperties}>
            <div className="buzzer__big buzzer__winner" data-testid="winner">{winner.name}</div>
            <ol className="buzzer__presses">
              {state.presses.map((p, i) => {
                const margin = i === 0 ? null : p.after - state.presses[i - 1].after;
                return (
                  <li key={p.dev} style={{ '--pc': playerOf(p.dev)?.color } as CSSProperties}>
                    <b>{nameOf(p.dev)}</b> {i === 0 ? seconds(p.after) : `+${ms(margin!)}`}
                    {margin != null && margin < PHOTO_FINISH_MS && <em title="Closer than the radio can order with confidence"> photo finish</em>}
                  </li>
                );
              })}
            </ol>
            <div className="buzzer__judge">
              <button type="button" className="btn btn--gold btn--lg" onClick={() => click({ type: 'CORRECT' })}>Right, +{state.value} <kbd>↵</kbd></button>
              <button type="button" className="btn btn--danger btn--lg" onClick={() => click({ type: 'WRONG', at: performance.now() })}>Wrong, −{state.value} <kbd>⌫</kbd></button>
            </div>
          </div>
        )}
        <button type="button" className="btn btn--sm btn--ghost buzzer__next" onClick={() => click({ type: 'NEXT' })}>Next question <kbd>esc</kbd></button>
      </section>

      <section className="buzzer__board" style={{ '--n': Math.max(1, state.players.length) } as CSSProperties}>
        {state.players.length === 0 && <div className="panel buzzer__empty">No players yet. {hub.connected ? 'Each player presses their button once while the floor is closed.' : 'Connect the hub, then each player presses their button once.'}</div>}
        {state.players.map((p) => (
          <div key={p.dev} className="buzzer__tile" style={{ '--pc': p.color } as CSSProperties} data-winner={winner?.dev === p.dev || undefined} data-out={lockedOut(p.dev) || undefined} data-lead={state.players.length > 1 && p.score === lead && lead > 0 ? '' : undefined} data-testid={`tile-${deviceTag(p.dev)}`}>
            <input className="buzzer__name" value={p.name} aria-label="Name" onChange={(e) => dispatch({ type: 'RENAME', dev: p.dev, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
            <div className="buzzer__score mono-num" data-testid="score">{p.score}</div>
            <div className="buzzer__adjust">
              <button type="button" className="btn btn--sm btn--ghost" aria-label={`${p.name} minus ${state.value}`} onClick={() => click({ type: 'SCORE', dev: p.dev, delta: -state.value })}>−</button>
              <button type="button" className="btn btn--sm btn--ghost" aria-label={`${p.name} plus ${state.value}`} onClick={() => click({ type: 'SCORE', dev: p.dev, delta: state.value })}>+</button>
            </div>
            {state.out.includes(p.dev) && <span className="buzzer__tag">out this question</span>}
            {(state.early[p.dev] ?? 0) > now && <span className="buzzer__tag">early</span>}
          </div>
        ))}
      </section>

      <section className="buzzer__foot">
        <div className="panel buzzer__devices">
          <div className="panel__head"><h3>Buttons</h3><span className="muted">{hub.connected ? `hub ${hub.hubFw ?? ''}` : 'no hub'}</span></div>
          {hub.devices.length === 0 && <p className="muted">None heard yet.</p>}
          {hub.devices.map((d) => (
            <div key={d.dev} className="buzzer__device" data-lost={d.lost || undefined}>
              <code>{deviceTag(d.dev).slice(-6)}</code>
              <span className="muted">{roleOf(d.dev) === 'player' ? playerOf(d.dev)!.name : roleOf(d.dev)}{d.fw ? ` · ${d.fw}` : ''}{d.dbm != null ? ` · ${d.dbm} dBm` : ''}{d.lost ? ' · lost' : ''}</span>
              <select className="select" aria-label={`Role of ${deviceTag(d.dev).slice(-6)}`} value={roleOf(d.dev)} onChange={(e) => {
                const role = e.target.value;
                if (role === 'host') dispatch({ type: 'SET_HOST', dev: d.dev });
                else if (role === 'player') dispatch({ type: 'ADD_PLAYER', dev: d.dev });
                else dispatch(d.dev === state.host ? { type: 'SET_HOST', dev: null } : { type: 'REMOVE_PLAYER', dev: d.dev });
              }}>
                <option value="host">Host</option>
                <option value="player">Player</option>
                <option value="spare">Spare</option>
              </select>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => sendToDevice({ t: 'id', dev: d.dev })}>Blink</button>
            </div>
          ))}
        </div>
        <div className="panel buzzer__help">
          <div className="panel__head"><h3>Keys</h3><button type="button" className="btn btn--sm btn--ghost" onClick={() => confirm('Set every score to zero?') && click({ type: 'RESET_SCORES' })}>Reset scores</button></div>
          <dl>
            <dt><kbd>space</kbd></dt><dd>open the floor, or close it again</dd>
            <dt><kbd>↵</kbd> <kbd>+</kbd></dt><dd>right: they score</dd>
            <dt><kbd>⌫</kbd> <kbd>−</kbd></dt><dd>wrong: they lose it and sit out; the floor reopens for the rest</dd>
            <dt><kbd>esc</kbd></dt><dd>next question</dd>
            <dt><kbd>1</kbd>–<kbd>8</kbd></dt><dd>what it's worth</dd>
            <dt>host's button</dt><dd>tap opens or closes, hold is next question. A press before the floor opens is early: dark for {EARLY_LOCK_MS / 1000} s.</dd>
          </dl>
        </div>
      </section>
    </div>
  );
}
