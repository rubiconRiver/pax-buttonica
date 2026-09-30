import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { turnEffectSpec, type LedMode, type PulseLook, type TurnLook } from '../engine/outputs';
import type { ReactionKind } from './game/useReactions';
import type { DeviceInput } from '../engine/types';
import { sfx, startCharge, unlockAudio } from '../audio/synth';
import { HEARTBEAT_MS, PULSE_MS, RIPPLE_MS } from '../hardware/protocol';
import { DEFAULT_SETTINGS } from '../state/settings';
import '../styles/device.css';

/** Presses shorter than this are taps; longer ones that let go early are abandoned holds. */
export const TAP_MAX_MS = 350;
/** A second tap landing this soon after the first is reported as `double`. */
export const DOUBLE_MS = 400;

/** How long a one-shot is on screen; the CSS animations run this long. Turn effects say for themselves. */
const reactionMs = (kind: ReactionKind) => (kind === 'denied' || kind === 'ack' || kind === 'hint' || kind === 'burst' ? 520 : turnEffectSpec(kind).ms);
/** Effects that also get the ring every button has always done. */
const WITH_SHOCK = new Set<ReactionKind>(['burst', 'explosion']);

export interface DeviceHandle {
  down(): void;
  up(): void;
}

interface Props {
  color: string;
  mode: LedMode;
  /** How `pulse` is drawn: the player's or the table's taste, or what the game asks for (the inward ripple to score). Defaults to breathing. */
  look?: TurnLook | PulseLook;
  size?: number;
  holdMs?: number;
  /** False when a hold would do nothing right now: the ring goes red while held and the hold ends refused, not confirmed. */
  holdOk?: boolean;
  /** 1 = just the dome. 3 = dome plus strategy and pass shortcuts. */
  buttons?: number;
  pan?: number;
  label?: string;
  hotkey?: string;
  /** A one-shot reaction, keyed so the same kind can fire twice in a row. */
  react?: { id: number; kind: ReactionKind } | null;
  silent?: boolean;
  onInput?(input: DeviceInput): void;
}

export const Device = forwardRef<DeviceHandle, Props>(function Device(
  { color, mode, look = 'pulse', size = 140, holdMs = DEFAULT_SETTINGS.holdMs, holdOk = true, buttons = 1, pan = 0, label, hotkey, react, silent, onInput },
  ref,
) {
  const [pressed, setPressed] = useState(false);
  const [held, setHeld] = useState(false);
  const [shock, setShock] = useState(0);
  const [reaction, setReaction] = useState<ReactionKind | null>(null);
  const t0 = useRef(0);
  const lastTap = useRef(-Infinity);
  const timers = useRef<number[]>([]);
  const stopCharge = useRef<() => void>(() => {});
  const live = useRef({ pressed: false, held: false });
  // Read when the hold time is up, not when the press began: the game may have changed its mind meanwhile.
  const holdOkNow = useRef(holdOk);
  holdOkNow.current = holdOk;
  const interactive = !!onInput;
  const root = useRef<HTMLDivElement>(null);

  // Start repeating lights part-way through their cycle, according to the clock on the wall, so every
  // button (on this screen, on a phone across the table) breathes and blinks in step.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const period = mode === 'pulse' ? (look === 'ripple_in' ? RIPPLE_MS : look === 'heartbeat' ? HEARTBEAT_MS : look === 'solid' ? 0 : PULSE_MS) : mode === 'flash' ? parseFloat(getComputedStyle(el).getPropertyValue('--flash-ms')) || 2000 : 0;
    el.style.animationDelay = period ? `-${Date.now() % period}ms` : '';
  }, [mode, look]);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    stopCharge.current();
    stopCharge.current = () => {};
  };

  const down = useCallback(() => {
    if (!interactive || live.current.pressed) return;
    unlockAudio();
    live.current = { pressed: true, held: false };
    t0.current = performance.now();
    setPressed(true);
    setHeld(false);
    if (!silent) sfx.down(pan);
    timers.current.push(
      window.setTimeout(() => {
        if (!silent && holdOkNow.current) stopCharge.current = startCharge(holdMs - TAP_MAX_MS, pan);
      }, TAP_MAX_MS),
      window.setTimeout(() => {
        live.current.held = true;
        stopCharge.current();
        setHeld(true);
        // Still reported: the game decides. A refusal it explains plays its own sound; this is only the light.
        if (holdOkNow.current) {
          setShock((n) => n + 1);
          if (!silent) sfx.confirm(pan);
        } else {
          setReaction('denied');
          window.setTimeout(() => setReaction((r) => (r === 'denied' ? null : r)), reactionMs('denied'));
        }
        onInput?.('hold');
      }, holdMs),
    );
  }, [interactive, holdMs, pan, silent, onInput]);

  const up = useCallback(() => {
    if (!live.current.pressed) return;
    const wasHeld = live.current.held;
    const elapsed = performance.now() - t0.current;
    live.current = { pressed: false, held: false };
    clear();
    setPressed(false);
    setHeld(false);
    if (!silent) sfx.up(pan);
    if (wasHeld || elapsed > TAP_MAX_MS) return;
    // Taps are reported at once (so acknowledging never lags); a quick second one adds `double`.
    const now = performance.now();
    if (now - lastTap.current <= DOUBLE_MS) {
      lastTap.current = -Infinity;
      onInput?.('double');
    } else {
      lastTap.current = now;
      onInput?.('tap');
    }
  }, [pan, silent, onInput]);

  useImperativeHandle(ref, () => ({ down, up }), [down, up]);
  useEffect(() => clear, []);

  useEffect(() => {
    if (!react) return;
    setReaction(react.kind);
    if (WITH_SHOCK.has(react.kind)) setShock((n) => n + 1);
    const t = window.setTimeout(() => setReaction(null), reactionMs(react.kind));
    return () => window.clearTimeout(t);
  }, [react?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = { '--size': `${size}px`, '--led': color, '--hold-ms': `${holdMs}ms` } as CSSProperties;
  // Particles for the effect playing, if it has any: stars, rings, debris…
  const layer = reaction && reaction !== 'denied' && reaction !== 'ack' && reaction !== 'hint' && reaction !== 'burst' ? turnEffectSpec(reaction) : null;

  return (
    <div
      ref={root}
      className="dev"
      style={style}
      data-mode={mode}
      data-look={mode === 'pulse' && look !== 'pulse' ? look : undefined}
      data-pressed={pressed || undefined}
      data-holding={(pressed && !held) || undefined}
      data-held={held || undefined}
      data-refused={!holdOk || undefined}
      data-react={reaction ?? undefined}
      data-static={!interactive || undefined}
    >
      <div className="dev__halo" />
      <div className="dev__base">
        <div className="dev__well" />
        <svg className="dev__ring" viewBox="0 0 100 100" aria-hidden>
          <circle className="dev__ring-track" cx="50" cy="50" r="45.5" />
          <circle className="dev__ring-fill" cx="50" cy="50" r="45.5" pathLength={100} />
        </svg>
        <button
          type="button"
          className="dev__dome"
          aria-label={label ?? 'Button'}
          tabIndex={interactive ? 0 : -1}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            down();
          }}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={(e) => {
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
              e.preventDefault();
              down();
            }
          }}
          onKeyUp={(e) => {
            if (e.key === ' ' || e.key === 'Enter') up();
          }}
          onBlur={up}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="dev__light" />
          <span className="dev__core" />
          <span className="dev__spec" />
          <span className="dev__deny" />
        </button>
        {hotkey && <kbd className="dev__key">{hotkey}</kbd>}
      </div>
      {shock > 0 && <span key={shock} className="dev__shock" />}
      {layer && (
        <span key={react?.id} className={`dev__fx dev__fx--${layer.layer}`} aria-hidden>
          {Array.from({ length: layer.count ?? 1 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}
        </span>
      )}
      {buttons >= 3 && interactive && (
        <div className="dev__aux">
          <button
            type="button"
            className="dev__auxbtn"
            title="Shortcut button: play my strategy card"
            onClick={() => {
              unlockAudio();
              sfx.click();
              onInput?.('strategy');
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden><rect x="6" y="3" width="12" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 8l1.2 2.6 2.8.3-2.1 1.9.6 2.8L12 14.2 9.5 15.6l.6-2.8L8 10.9l2.8-.3z" fill="currentColor" /></svg>
          </button>
          <button
            type="button"
            className="dev__auxbtn"
            title="Shortcut button: pass"
            onClick={() => {
              unlockAudio();
              sfx.click();
              onInput?.('pass');
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden><path d="M5 12h11M12 7l5 5-5 5M20 5v14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      )}
    </div>
  );
});
